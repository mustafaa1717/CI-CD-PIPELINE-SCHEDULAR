const express = require('express');
const passport = require('passport');
const router = express.Router();

// 1. Kick off the GitHub login. 
// We ask for 'repo' and 'admin:repo_hook' permissions so we can set up webhooks later!
router.get('/github',
  passport.authenticate('github', { scope: [ 'user:email', 'repo', 'admin:repo_hook' ] })
);

// 2. GitHub sends the user back here after they authorize
router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/' }),
  function(req, res) {
    // Successful authentication, redirect to React frontend Dashboard
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/dashboard`);
  }
);

// 3. Get current logged in user (The React frontend will call this to see if the user is logged in)
router.get('/current-user', (req, res) => {
  res.json(req.user || null);
});

// 4. Logout
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173/');
  });
});

module.exports = router;
