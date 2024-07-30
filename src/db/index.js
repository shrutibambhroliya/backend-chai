import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connectionDB = await mongoose.connect(`${process.env.MONGODB_URL}`);
    console.log(
      `\n MONGODB connected !! DB HOST ${connectionDB.connection.host}`
    );
  } catch (error) {
    console.log("mongodb connection error", error);
    process.exit(1);
  }
};

export default connectDB;
