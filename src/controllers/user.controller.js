import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// high-order function
const registerUser = asyncHandler(async (req, res) => {
  //get user details from fronted
  //validation -not empty
  //check if user already exists:username, email
  //check for image,check for avatar
  //upload them to cloudinary ,avatar
  //create user object- create entry in db
  //remove password and refresh token field from response
  //check for user creation
  //return res

  const { userName, fullName, email, password } = req.body;
  console.log("email", email);

  if (
    [userName, fullName, email, password].some((field) => field?.trim() === "")
  ) {
    throw new apiError(404, "all field is required");
  }

  const existUser = User.findOne({
    $or: [{ userName }, { email }],
  });

  if (existUser) {
    throw new apiError(406, "User with email and userName is already exist");
  }

  const localPathAvatar = req.files?.avatar[0]?.path;
  const localPathCoverImage = req.files?.coverImage[0]?.path;

  if (!localPathAvatar) {
    throw new apiError(409, "avatar file is require");
  }

  const avatar = await uploadOnCloudinary(localPathAvatar);
  const coverImage = await uploadOnCloudinary(localPathCoverImage);

  if (!avatar) {
    throw new apiError(409, "avatar file is require");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName.toLowerCase(),
  });
  //select me all value is select but jo -pass hai vo delete ho jayega database mese

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new apiError(500, "something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user registered successfully"));
});

export { registerUser };
