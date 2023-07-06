//import the necessary methods from azle
import {$init, $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, nat, nat8,Principal} from 'azle';

//define a Record to store the all the details about the task
type Task = Record <{
    title : string; //title of the task
    description : string; //a brief description of the task
    assignedTo : string; // the team member to whom it is assigned
    isDone: boolean; // to track whether the task has been completed 
    startTIme : nat64; //the time at which the task started
    deadline: nat8; //deadline in hours
}>

//define a Record to store the user input for the task
type TaskLoad = Record <{
    title : string;
    description: string;
    assignedTo: string;
    deadline: nat8;
}>

//replace this with your principal from the terminal or the Internet Identity
//admin principal ID in a string format
var AdminPrincipal : string = "2vxsx-fae";


//store team members
let memberCount : nat8 = 0;
const memberStore = new StableBTreeMap<nat8, Principal>(0,100,1000);

//store tasks 
let taskCount : nat8 = 0;
const taskStore = new StableBTreeMap<nat8, Task>(1,100,1000);

//set the contract deployer as the admin
$init;
export function init (admin : string) : void{
    AdminPrincipal = admin;
};

//return the one that deployed the contract
$query;
export function contractOwner() : Principal{
    return Principal.fromText(AdminPrincipal)
}
//add new team member by the admin
$update;
export function addMember( principalID : string) : Result<nat8, string>{
    if(ic.caller().toString() !== AdminPrincipal){
        return Result.Err<nat8,string>("You are not authorised to add new members");
    }
    memberCount = (memberCount + 1);
    memberStore.insert(memberCount, Principal.fromText(principalID));
    return Result.Ok(memberCount);
}


//delete team member by the admin
$update;
export function deleteMember( id : nat8) : Result<string, string>{
    if(ic.caller().toString() !== AdminPrincipal){
        return Result.Err<string,string>("You are not authorised to delete members");
    }
    
    return match(memberStore.remove(id),{
        Some : (deletedID) =>{ return Result.Ok<string,string>("Member has been deleted")},
        None : ()=>{ return Result.Err<string,string>("Member cannot be found")}
    });
}


//get team member by id
$query;
export function getMember(id : nat8) : Result<Principal,string>{
    return match(memberStore.get(id),{
        Some: (member)=>{ return Result.Ok<Principal,string>(member)},
        None: () =>{ return Result.Err<Principal,string>("Member does not exist")}
    });
}


//update the principal of the team member by the admin
$update;
export function updateMember(id : nat8, _newName : string) : Result<nat8,string>{
    if(ic.caller().toString() !== AdminPrincipal){
        return Result.Err<nat8,string>("You are not authorised to update members");
    }
    return match(memberStore.get(id),{
        Some : ()=>{
            if(_newName.length == 0){
                return Result.Err<nat8, string>("new Principal cant be empty");
            };
            memberStore.insert(id, Principal.fromText(_newName));
            return Result.Ok<nat8,string>(id);
        },
        None : ()=>{ return Result.Err<nat8,string>("Member has not been found")}

    });
}

//get all team members
$query;
export function getAllMembers() : Result<Vec<Principal>, string>{
    if((memberStore.values()).length == 0){
        return Result.Err<Vec<Principal>,string>("No family members yet");
    };
    return Result.Ok<Vec<Principal>,string>(memberStore.values());
}

//get all tasks stored in the contract
$query;
export function getAllTasks() : Result<Vec<Task>,string>{
    if((taskStore.values()).length === 0){
        return Result.Err<Vec<Task>,string>("No tasks yet");
    };
    return Result.Ok<Vec<Task>,string>(taskStore.values());
}

///get specific task by its id
$query;
export function getTask(id : nat8) : Result<Task,string>{
    return match(taskStore.get(id),{
        Some : (task)=>{ return Result.Ok<Task,string>(task)},
        None : ()=>{ return Result.Err<Task,string>("No task found with that id")}
    });
};

//delete task by the admin using its id
$update;
export function deleteTask(id : nat8) : Result<string,string>{
    if(ic.caller().toString() !== AdminPrincipal){
        return Result.Err<string,string>("You are not authorised to update members");
    }
    return match(taskStore.remove(id),{
        Some : ()=>{ return Result.Ok<string,string>("task deleted")},
        None : ()=>{ return Result.Err<string,string>("No task found with that id")}
    });
};

//check if the principal ID is among the team  members
$query;
export function isMember( p : string) : boolean{
    const ismember = memberStore.values().filter((member) => member.toString()  === p);
    if(ismember.length > 0){
        return true;
    }
    return false;
};


//return the tasks for a specific team member depending on the condition(isDone)
$query;
export function personalTasks( p : string, condition:boolean) : Vec<Task>{
    const myTasks = taskStore.values().filter((task) => ((task.assignedTo  === p) && task.isDone === condition));
    return myTasks;
};

//calculate and convert the hours to nanoseconds
const hoursToNanoseconds = (hours: nat8): number => {
    const minutes = hours * 60;
    const seconds = minutes * 60;
    const milliseconds = seconds * 1000;
    const microseconds = milliseconds * 1000;
    const nanoseconds = microseconds * 1000;
    return nanoseconds;
  };


//search for tasks by the title or description
$query;
export function searchTasks(query: string): Result<Vec<Task>, string> {
    const myTasks = taskStore.values();
    const matchingTasks: Vec<Task> = myTasks.filter((task) => {
        const inTitle = task.title.toLowerCase().includes(query.toLowerCase());
        const inDescription = task.description.toLowerCase().includes(query.toLowerCase());
        return inTitle || inDescription;
    });
    return Result.Ok(matchingTasks);
}


//add a task by the admin and assign it to the team member
$update;
export function addTask( payload: TaskLoad) : Result<nat8,string>{
    if(!(ic.caller().toString() === AdminPrincipal)){
        return Result.Err<nat8,string>("Only admins can add tasks");
    }
    if(!isMember(payload.assignedTo)){
        return Result.Err<nat8,string>("Assigned Member does not exist");
    };
    if( payload.title.length === 0 || payload.description.length === 0 || payload.deadline < 1){
        return Result.Err<nat8,string>("Malformed values");
    }

    const newTask : Task={
        ...payload,
        startTIme : ic.time(),
        isDone : false,
    };

    taskCount = (taskCount +1);
    taskStore.insert(taskCount, newTask);
    return Result.Ok<nat8,string>(taskCount);
};

//complete the task by the member
$update;
export function completeTask(id : nat8) : Result<string,string>{
    return match(taskStore.get(id),{
        None: ()=>{ return Result.Err<string,string>("Task not found")},
        Some : (task) =>{
            if(task.assignedTo !== ic.caller().toString()){
                return Result.Err<string,string>("You were not assigned to this task")
            }
            const taskDeadline = task.startTIme + BigInt(hoursToNanoseconds(task.deadline));
            if(taskDeadline < ic.time()){
                return Result.Err<string,string>("Deadline has already passed")
            }

            const newTask : Task = {
                ...task,
                isDone : true,
            };
            taskStore.insert(id, newTask);
            return Result.Ok<string,string>("Task completed successfully");
        }
    });
}
