const mongoose= require('mongoose');

const connectDb= async()=>{
    await mongoose.connect("mongodb+srv://singhsshreya297_db_user:GnxPpcUi4yX9zgry@triptrail-dev.6mjibbr.mongodb.net/triptraildb");

}

module.exports = connectDb;