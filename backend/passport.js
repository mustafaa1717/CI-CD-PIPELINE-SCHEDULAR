const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('./models/User');

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/github/callback"
  },
  async function(accessToken, refreshToken, profile, done) {
    try {
      // 1. Check if this GitHub user already exists in our MongoDB
      let user = await User.findOne({ githubId: profile.id });
      
      if (!user) {
        // 2. If new user, create them and save their token
        user = new User({
          githubId: profile.id,
          username: profile.username,
          accessToken: accessToken 
        });
        await user.save();
      } else {
        // 3. Update their token if it changed
        user.accessToken = accessToken;
        await user.save();
      }
      
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// These tell Passport how to attach the user to the session cookie
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});
