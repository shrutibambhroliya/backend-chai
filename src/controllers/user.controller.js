import { asyncHandler } from "../utils/asyncHandler.js";

// high-order function
const registerUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: "hello ",
  });
});

export { registerUser };
