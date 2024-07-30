import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(`${process.env.MONGODB_URL}`);
    console.log(
      `\n MONGODB connected !! DB HOST ${connection.connection.host}`
    );
  } catch (error) {
    console.log("mongodb connection error", error);
    process.exit(1);
  }
};

export default connectDB;
