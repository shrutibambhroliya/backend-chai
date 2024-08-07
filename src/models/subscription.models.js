import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    subscriber: {
      type: mongoose.Types.ObjectId, //one whose is subsribing
      ref: "User",
    },
    channel: {
      type: mongoose.Types.ObjectId, //one to whom 'subscriber' is subscribing
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
