const sql = require('../models/db');

const getAllTasks= async (req,res)=>{
    try{
    const tasks = await sql`SELECT * FROM tasks order by created_at;`;
    console.log(tasks)

  return res.json(tasks);
}
  catch(err){
    console.log(err);
    res.status(500).send('Server error');
  }
}

module.exports = {
    getAllTasks
  };
//   ,
//     createTask,
//     deleteTask,
//     updateTask,
//     markTaskComplete,