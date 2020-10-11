const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { check, validationResult } = require("express-validator");
const checkId = require("../middleware/checkId");
const Profile = require("../models/Profile");
const User = require("../models/User");
const Post = require("../models/Post");

// @route    GET api/profile/me
// @desc     Get current users profile
// @access   Private
router.get("/me", auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({
      user: req.user.id,
    }).populate("user", ["username"]);

    if (!profile) {
      return res
        .status(400)
        .json({ msg: "No Profile for the requested User found" });
    }

    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// @route    POST api/profile
// @desc     Create or update user profile
// @access   Private
router.post(
  "/create",
  auth,
  [check("name", "Name is required").not().isEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bio, website, name } = req.body;

    profileFields = {
      user: req.user.id,
      bio,
      website,
      name,
    };
    try {
      let profile = await Profile.findOne({ user: req.user.id });

      if (profile) {
        profile = await Profile.updateOne(
          { user: req.user.id },
          { $set: profileFields },
          { new: true, upsert: true }
        );

        return res.json(profile);
      }

      if (!profile) {
        const newProfile = new Profile(profileFields);
        profile = await newProfile.save();
        return res.json(profile);
      }
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  }
);

//@route  POST /api/profile/changepb
//@desc   Change the current PB of the logged in User
//@access Private
router.post("/changepb", auth, async (req, res) => {
  try {
    console.log(req.files);
    if (!req.files) {
      return res.status(400).json({ msg: "No file Uploaded" });
    }

    const profilePic = req.files.image;

    if (!(profilePic.mimetype == "image/png" || profilePic.mimetype == "image/jpg" || profilePic.mimetype == "image/jpeg")) {
      return res.status(400).send("No Image Uploaded")
    }
    
    const id = req.user.id;

    //const ending = profilePic.mimetype.replace("image/png", ".png");

    const fileName = id + ".png";

    profilePic.mv(`./public/${fileName}`);

    let profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { $set: {profileImage: fileName} },
      { new: true, upsert: true }
    );

    res.json(profile);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Internal Server error");
  }
});

//@route  GET /api/profile/all
//@desc   Get all Profiles
//@access Public
router.get("/all", async (req, res) => {
  try {
    const profiles = await Profile.find().populate("user", ["username"]);
    res.json(profiles);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

//@route  GET api/profile/:username
//@desc   Get the Userprofile by id
//@access Public
router.get(
  "/user/:user_id",
  checkId("user_id"),
  async ({ params: { user_id } }, res) => {
    try {
      const profile = await Profile.findOne({
        user: user_id,
      }).populate("user", ["username"]);

      if (!profile) return res.status(400).json({ msg: "Profile not found" });

      return res.json(profile);
    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

//@route  DELETE api/profile/delete
//@desc   Delete the current User, Profile and Posts
//@access Private
router.delete("/delete", auth, async (req, res) => {
  try {
    //TODO Remove Users Posts after implement

    //Delete Profile
    await Profile.deleteOne({ user: req.user.id });

    //Delete User
    await User.deleteOne({ user: req.user.id });

    return res.json({ msg: "User deleted" });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Internal Server Error");
  }
});

//@route  POST api/profile/follows/:user_id
//@desc   Increase the followers
//@access Private
router.post("/follows/:user_id", auth, async (req, res) => {
  try {
    const profileFollowing = await Profile.findOne({ user: req.user.id });
    const profileFollows = await Profile.findOne({ user: req.params.user_id });

    if (!profileFollows) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (profileFollowing.id === profileFollows.id) {
      return res.status(400).json({ msg: "Same User" });
    }

    if (
      profileFollowing.following.filter(
        (follow) => follow.user.toString() === req.params.user_id
      ).length > 0
    ) {
      return res.status(400).json({ msg: "already following" });
    }

    profileFollowing.following.unshift({ user: req.params.user_id });

    await profileFollowing.save();

    profileFollows.follower.unshift({ user: req.user.id });

    await profileFollows.save();

    res.json({ profileFollowing, profileFollows });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Internal Server Error");
  }
});

//@route  POST api/profile/unfollows/:user_id
//@desc   Unfollow a user
//@access Private
router.post("/unfollows/:user_id", auth, async (req, res) => {
  try {
    const profileFollowing = await Profile.findOne({ user: req.user.id });
    const profileFollows = await Profile.findOne({ user: req.params.user_id });

    if (!profileFollows) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (profileFollowing === profileFollows) {
      return res.status(400).json({ msg: "Same User" });
    }

    if (
      profileFollowing.following.filter(
        (follow) => follow.user.toString() === req.params.user_id
      ).length === 0
    ) {
      return res.status(400).json({ msg: "Not following right now" });
    }

    const removeFollowingIndex = profileFollowing.following.map((follow) =>
      follow.user.toString().indexOf(req.params.user_id)
    );

    profileFollowing.following.splice(removeFollowingIndex, 1);

    await profileFollowing.save();

    const removeFollowsIndex = profileFollows.follower.map((follow) =>
      follow.user.toString().indexOf(req.user.id)
    );

    profileFollows.follower.splice(removeFollowsIndex, 1);

    await profileFollows.save();

    res.json({ profileFollowing, profileFollows });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
