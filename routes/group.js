const express = require("express");
const router = express.Router();
//middleware
const auth = require("../middleware/auth");
const checkId = require("../middleware/checkId");
const { check, validationResult } = require("express-validator");

//models
const Group = require("../models/Group");
const User = require("../models/User");
const Post = require("../models/Post");

// @route    POST api/group/create
// @desc     Create a Group
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

    const { name, desc, isPrivate } = req.body;

    groupFields = {
      name,
      desc,
      private: isPrivate,
    };

    try {
      let group = await Group.findOne({ name });

      if (group) {
        return res.status(400).send("Group with this name already exist");
      }

      const newGroup = new Group(groupFields);
      newGroup.members.unshift({ user: req.user.id });
      newGroup.admins.unshift({ user: req.user.id });
      group = await newGroup.save();
      return res.json(group);
    } catch (err) {
      console.log(err);
      return res.status(500).send("Server error");
    }
  }
);

// @route    POST api/group/update/:id
// @desc     Update a Group
// @access   Private
router.post("/update/:id", auth, async (req, res) => {
  const { name, desc, private } = req.body;

  groupFields = {
    name,
    desc,
    private,
  };

  try {
    let group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(400).send("Group does not exist");
    }

    if (
      group.admins.filter((admin) => admin.user.toString() === req.user.id)
        .length === 0
    ) {
      return res.status(400).send("Access denied");
    }

    const groupUpdate = await Group.findByIdAndUpdate(
      req.params.id,
      { $set: groupFields },
      { new: true, upsert: true }
    );

    return res.json(groupUpdate);
  } catch (err) {
    console.log(err);
    return res.status(500).send("Server error");
  }
});

// @route    POST api/group/update/:id
// @desc     Update the Group Image
// @access   Private
router.post("/updatepb/:id", [auth], async (req, res) => {
  try {

    let group = await Group.findById(req.params.id);
    
    if(!req.files) {
      return res.status(400).json({ msg: "No file Uploaded" });
    }

    if (
      !group.admins.some((admin) => admin.user.toString() === req.user.id)
    ) {
      return res.status(400).send("Not an Admin");
    }

    const groupImage = req.files.image;

    if (!(groupImage.mimetype == "image/png" || groupImage.mimetype == "image/jpg" || groupImage.mimetype == "image/jpeg")) {
      return res.status(400).send("No Image Uploaded")
    }

    const ending = groupImage.mimetype.replace("image/", ".");

    const fileName = req.params.id + ending;

    groupImage.mv(`./public/${fileName}`);
    
    await group.update({$set: {groupImage: fileName}}, { new: true, upsert: true });
    
    await group.save();

    return res.json(group);
  } catch (err) {
    console.log(err);
    return res.status(500).send("Server error");
  }
});

// @route    GET api/group/all
// @desc     get all Groups
// @access   Public
router.get("/all", async (req, res) => {
  try {
    const groups = await Group.find();
    return res.json(groups);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server Error");
  }
});

// @route    GET api/group/:id
// @desc     get Group by id
// @access   Public
router.get("/get-group/:id", checkId("id"), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(400).send("Group not found");
    }

    return res.json(group);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server Error");
  }
});

// @route    POST api/group/add/:id
// @desc     Add a new Member to a Group
// @access   Private
router.post("/add/:id", [auth, checkId("id")], async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(400).send("Group not found");
    }

    if (
      group.members.some((member) => member.user.toString() === req.user.id)
    ) {
      return res.status(400).send("Already Member");
    }

    group.members.unshift({ user: req.user.id });

    await group.save();

    return res.json(group);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server Error");
  }
});

// @route    POST api/group/unadd/:id
// @desc     remove a Member from a Group
// @access   Private
router.post("/unadd/:id", [auth, checkId("id")], async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).send("Group not found");
    }

    if (
      !group.members.some((member) => member.user.toString() === req.user.id)
    ) {
      return res.status(400).send("Not a Member yet");
    }

    group.members = group.members.filter(
      ({ user }) => user.toString() !== req.user.id
    );

    await group.save();

    return res.json(group);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server Error");
  }
});

// @route    POST api/group/add-admin/:group_id/:id
// @desc     Add an Admin to a Group
// @access   Private
router.post(
  "/add-admin/:group_id/:id",
  [auth, checkId("id"), checkId("group_id")],
  async (req, res) => {
    try {
      const group = await Group.findById(req.params.group_id);
      const newAdmin = await User.findById(req.params.id);

      if (!newAdmin) {
        return res.status(404).send("User not found");
      }

      if (!group) {
        return res.status(404).send("Group not found");
      }

      if (
        !group.admins.some((admin) => admin.user.toString() === req.user.id)
      ) {
        return res.status(400).send("Not an Admin");
      }

      if (
        !group.members.some(
          (member) => member.user.toString() === newAdmin._id.toString()
        )
      ) {
        return res.status(400).send("Not a Member yet");
      }

      if (
        group.admins.some(
          (admin) => admin.user.toString() === newAdmin._id.toString()
        )
      ) {
        return res.status(400).send("User already an Admin");
      }

      group.admins.unshift({ user: newAdmin._id });

      await group.save();

      return res.json(group);
    } catch (err) {
      console.error(err);
      return res.status(500).send("Server Error");
    }
  }
);

// @route    POST api/group/uadd-admin/:group_id/:id
// @desc     remove an Admin from a Group
// @access   Private
router.post(
  "/unadd-admin/:group_id/:id",
  [auth, checkId("group_id"), checkId("id")],
  async (req, res) => {
    try {
      const group = await Group.findById(req.params.group_id);
      const removedAdmin = await User.findById(req.params.id);

      if (!removedAdmin) {
        return res.status(404).send("User not found");
      }

      if (!group) {
        return res.status(404).send("Group not found");
      }

      if (
        !group.admins.some((admin) => admin.user.toString() === req.user.id)
      ) {
        return res.status(400).send("Not an Admin");
      }

      if (
        !group.admins.some(
          (admin) => admin.user.toString() === removedAdmin._id.toString()
        )
      ) {
        return res.status(400).send("Not an Admin");
      }

      if (
        !group.members.some(
          (member) => member.user.toString() === removedAdmin._id.toString()
        )
      ) {
        return res.status(400).send("Not a Member yet");
      }

      if (
        !group.admins.some(
          (admin) => admin.user.toString() === removedAdmin._id.toString()
        )
      ) {
        return res.status(400).send("User already a Admin");
      }

      group.admins = group.admins.filter(
        ({ user }) => user.toString() !== removedAdmin._id.toString()
      );

      await group.save();

      return res.json(group);
    } catch (err) {
      console.error(err);
      return res.status(500).send("Server Error");
    }
  }
);

// @route    POST api/group//group-post/:id
// @desc     Add a new Post
// @access   Private
router.post(
  "/group-post/:id",
  [[check("text", "Text is required").not().isEmpty()], auth],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const group = await Group.findById(req.params.id);

      if(!group) {
        return res.status(400).send("No group found");
      }

      if (
        !group.members.some((member) => member.user.toString() === req.user.id)
      ) {
        return res.status(400).send("not a Member");
      }

      const user = await User.findById(req.user.id).select("-password");

      const newPost = new Post({
        text: req.body.text,
        username: user.username,
        user: req.user.id,
      });

      const post = await newPost.save();

      const newPosting = await Post.findById(post._id);

      group.posts.unshift({post: newPosting._id});
      
      await group.save();

      return res.json(group)
    } catch (err) {
      console.error(err);
      return res.status(500).send("Server Error");
    }
  }
);

// @route    DELETE api/group/delete-group-post/:group_id/:id
// @desc     Delete a Post
// @access   Private
router.delete("/delete-group-post/:group_id/:id", [auth, checkId("group_id"), checkId("id")], async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const group = await Group.findById(req.params.group_id);

    if(!post) {
      return res.status(404).send("No post found");
    }

    if(!group) {
      return res.status(404).send("No Group found");
    }

    if (post.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    const removeIndex = group.posts.map(post => post._id.toString().indexOf(req.params.id))

    group.posts.splice(removeIndex, 1);

    await group.save();

    await post.remove();

    return res.json(group);
  } catch(err) {
    console.error(err);
    return res.status(500).send("Server Error");
  }
});

// @route    GET api/group/get-group-posts/:id/
// @desc     get all Posts from a Group
// @access   Public
router.get("/get-group-posts/:id", [checkId("id")], async (req, res) => {
  try {
    const groupsPosts = await Group.findById(req.params.id).select("posts");

    return res.json(groupsPosts);
  } catch(err) {
    console.error(err);
    return res.status(500).send("Server Error");
  }
})

module.exports = router;
