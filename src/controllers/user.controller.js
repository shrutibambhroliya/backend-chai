import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import fs from "fs";
import { channel, hasSubscribers } from "diagnostics_channel";

//token refresh and access

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    console.log(user);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    console.log("userRef", user.refreshToken);

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    // console.error("Tokens generate karte waqt error:", error);
    throw new apiError(
      500,
      "something went wrong while generating refresh and access token"
    );
  }
};

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
  // console.log(req.body);

  const existUser = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (existUser) {
    throw new apiError(406, "User with email and userName is already exist");
  }

  // console.log(req.files);
  const localPathAvatar = req.files?.avatar[0]?.path;

  // const localPathCoverImage = req.files?.coverImage[0]?.path;
  let localPathCoverImage;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    localPathCoverImage = req.files.coverImage[0].path;
  }

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

const loginUser = asyncHandler(async (req, res) => {
  //req.body -> data
  //usereName or email
  //find the user
  //password check
  //access and refresh token
  //send cookie

  const { userName, email, password } = req.body;

  if (!userName && !email) {
    throw new apiError(400, "userName or email is required");
  }

  const user = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (!user) {
    throw new apiError(404, "user does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new apiError(401, "invalid user credential");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged In successfully"
      )
    );
});

const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );
  console.log("token error");
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged out"));
});

//access token ko refresh
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new apiError(400, "unAuthorized request");
  }

  try {
    const decodeToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodeToken?._id);
    console.log("userDecode", user);

    if (!user) {
      throw new apiError(400, "invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new apiError(400, "refresh token is expire or used");
    }

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user?._id);

    const options = {
      httpOnly: true,
      secure: true,
    };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "access token refresh"
        )
      );
  } catch (error) {
    throw new apiError(401, error?.message || "invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { newPassword, oldPassword } = req.body;
  const user = await User.findById(req.user?._id);
  const isCorrectPass = user.isPasswordCorrect(oldPassword);
  if (!isCorrectPass) {
    throw new apiError(400, "invalid old Password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password change succesfull"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fatched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new apiError(400, "all field is required");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      //jo update karna hota hai vo
      $set: {
        fullName: fullName,
        email: email,
      },
    },
    { new: true } //new means value updated and after new value is coming so true
  );

  return res
    .status(200)
    .json(new ApiResponse(200, user, "account details updated successfully!"));
});

const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  const user = await User.findById(req.user?.id);

  const oldAvatar = user.avatar;

  if (!oldAvatar) {
    throw new apiError(400, "oldAvatar is required");
  }
  //old avatar delete

  await deleteFromCloudinary(oldAvatar);

  // new avatar upload
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new apiError(400, "error while uploading on avatar");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "avatar updated successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImgLocalPath = req.file?.path;

  if (!coverImgLocalPath) {
    throw new apiError(400, "cover image path is missing");
  }
  //oldImage find
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new apiError(400, "image is required");
  }
  const oldImage = user.coverImage;
  if (!oldImage) {
    throw new apiError(400, "old image is required");
  }
  //old image delete
  await deleteFromCloudinary(oldImage);

  //new image upload

  const coverImage = await uploadOnCloudinary(coverImgLocalPath);
  if (!coverImage.url) {
    throw new apiError(400, "error while uploading on coverImage");
  }

  const updateUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { coverImage: coverImage.url } },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, updateUser, "coverImage updated successfully!"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { userName } = req.params;

  if (!userName?.trim()) {
    throw new apiError(400, "username is missing");
  }

  User.aggregate([
    { $match: { userName: userName?.toLowerCase() } },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $set: "subscribers",
        },
        channelsSubscribedToCount: {
          $set: "subscribedTo",
        },
        isSubscribed: {
          $cond: {
            $if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        userName: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
      },
    },
  ]);

  if (!channel) {
    throw new apiError(400, "channel does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

export {
  registerUser,
  loginUser,
  logOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  getUserChannelProfile,
};
