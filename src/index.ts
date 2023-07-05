
import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, nat, nat8,Principal} from 'azle';


type Task = Record <{
    title : string;
    description : string;
    assignedTo : string;
    isDone: boolean;
    startTIme : nat64;
    deadline: nat8; //deadline in hours
}>

type TaskLoad = Record <{
    title : string;
    description: string;
    assignedTo: string;
    deadline: nat8;
}>

//replace this with your principal from the termianl or the Internet Isentity
const AdminPrincipal : string = "2vxsx-fae";


//store family members
let memberCount : nat8 = 0;
const memberStore = new StableBTreeMap<nat8, Principal>(0,100,1000);

//store tasks 
let taskCount : nat8 = 0;
const taskStore = new StableBTreeMap<nat8, Task>(1,100,1000);


//add new family member
$update;
export function addMember( principalID : string) : Result<nat8, string>{
    if(ic.caller().toString() != AdminPrincipal){
        return Result.Err<nat8,string>("You are not authorised to add new members");
    }
    memberCount = (memberCount + 1);
    memberStore.insert(memberCount, Principal.fromText(principalID));
    return Result.Ok(memberCount);
}


//delete family member
$update;
export function deleteMember( id : nat8) : Result<string, string>{
    if(ic.caller().toString() != AdminPrincipal){
        return Result.Err<string,string>("You are not authorised to delete members");
    }
    
    return match(memberStore.remove(id),{
        Some : (deletedID) =>{ return Result.Ok<string,string>("Member has been deleted")},
        None : ()=>{ return Result.Err<string,string>("Member cannot be found")}
    });
}


//get family member by id
$query;
export function getMember(id : nat8) : Result<Principal,string>{

    return match(memberStore.get(id),{
        Some: (member)=>{ return Result.Ok<Principal,string>(member)},
        None: () =>{ return Result.Err<Principal,string>("Member does not exist")}
    });
}


//update the principal of the family member
$update;
export function updateMember(id : nat8, _newName : string) : Result<nat8,string>{
    if(ic.caller().toString() != AdminPrincipal){
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

//get all family members
$query;
export function getAllMembers() : Result<Vec<Principal>, string>{
    if((memberStore.values()).length == 0){
        return Result.Err<Vec<Principal>,string>("No family members yet");
    };
    return Result.Ok<Vec<Principal>,string>(memberStore.values());
}

//get all tasks
$query;
export function getAllTasks() : Result<Vec<Task>,string>{
    if((taskStore.values()).length == 0){
        return Result.Err<Vec<Task>,string>("No tasks yet");
    };
    return Result.Ok<Vec<Task>,string>(taskStore.values());
}

///get specific task
$query;
export function getTask(id : nat8) : Result<Task,string>{
    return match(taskStore.get(id),{
        Some : (task)=>{ return Result.Ok<Task,string>(task)},
        None : ()=>{ return Result.Err<Task,string>("No task found with that id")}
    });
};

//delete task
$update;
export function deleteTask(id : nat8) : Result<string,string>{
    if(ic.caller().toString() != AdminPrincipal){
        return Result.Err<string,string>("You are not authorised to update members");
    }
    return match(taskStore.remove(id),{
        Some : ()=>{ return Result.Ok<string,string>("task deleted")},
        None : ()=>{ return Result.Err<string,string>("No task found with that id")}
    });
};

//is member of the family
$query;
export function isMember( p : string) : boolean{
    const ismember = memberStore.values().filter((member) => member.toString()  === p);
    if(ismember.length > 0){
        return true;
    }
    return false;
};


//return the tasks for a specific member depending on the condition
$query;
export function personalTasks( p : string, condition:boolean) : Vec<Task>{
    const myTasks = taskStore.values().filter((task) => ((task.assignedTo  === p) && task.isDone === condition));
    return myTasks;
};

//calculate the hours to nanoseconds
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


//add a task for the family member
$update;
export function addTask( payload: TaskLoad) : Result<nat8,string>{
    if(!(ic.caller().toString() == AdminPrincipal)){
        return Result.Err<nat8,string>("Only admins can add tasks");
    }
    if(!isMember(payload.assignedTo)){
        return Result.Err<nat8,string>("Assigned Member does not exist");
    };
    if( payload.title.length == 0 || payload.description.length == 0 || payload.deadline < 1){
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
                return Result.Err<string,string>("Not the task owner")
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
