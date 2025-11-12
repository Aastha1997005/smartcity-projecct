const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");


const {db} = require("../db");
const fs = require('fs');

// Create/send notifications. Authorized roles may create notifications; admin may broadcast.
router.post("/send", authenticateToken, authorizeRoles("admin", "transport", "utility", "healthcare", "internet"), async (req, res) => {
  const { message, user_ids, all } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    let recipients = [];
    const callerRole = (req.user && req.user.role) || '';
    const senderId = (req.user && req.user.id) || null;

    // If explicit user_ids provided, use them
    if (Array.isArray(user_ids) && user_ids.length > 0) {
      recipients = user_ids.map(id => parseInt(id)).filter(n => Number.isFinite(n));
    }

    // If admin requested a broadcast (all=true) treat it as a single announcement row
    const isBroadcast = (all === true || all === 'true');
    if (isBroadcast && callerRole === 'admin') {
      // Store a single announcement row with user_id set to the creator's id so fetches are public and attributed
      try {
        try {
          await db.query('INSERT INTO Notifications (user_id, message, is_read, sender_id) VALUES (?, ?, ?, ?)', [senderId, message, 0, senderId]);
        } catch (insErr) {
          console.error('Insert single broadcast failed, attempting to add sender_id column and retry:', insErr && insErr.message);
          try {
            await db.query('ALTER TABLE Notifications ADD COLUMN sender_id INT NULL');
            await db.query('INSERT INTO Notifications (user_id, message, is_read, sender_id) VALUES (?, ?, ?, ?)', [senderId, message, 0, senderId]);
          } catch (secondErr) {
            console.error('Failed to add sender_id or insert single broadcast, falling back to insert without sender_id:', secondErr && secondErr.message);
            await db.query('INSERT INTO Notifications (user_id, message, is_read) VALUES (?, ?, ?)', [senderId, message, 0]);
          }
        }
        return res.json({ message: 'Broadcast announcement created', broadcast: true, sender_id: senderId });
      } catch (errIns) {
        console.error('Broadcast insert error:', errIns);
        try { fs.appendFileSync('./tmp_notifications_errors.log', new Date().toISOString() + ' - broadcast insert failed: ' + String(errIns) + '\n'); } catch(e){}
        return res.status(500).json({ error: 'Failed to create broadcast announcement' });
      }
    }

    // Non-broadcast: require explicit recipients
    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients specified' });
    }

    // Prepare bulk insert values; prefer to record sender_id if column exists.
    const values = recipients.map(u => [u, message, 0, senderId]);

    // Attempt to insert with sender_id column. If the column doesn't exist, try to ALTER TABLE once and fallback.
    try {
      await db.query('INSERT INTO Notifications (user_id, message, is_read, sender_id) VALUES ?', [values]);
    } catch (insertErr) {
      // If the error looks like unknown column, try to add the column and retry
      const msg = insertErr && insertErr.message ? insertErr.message : String(insertErr);
      console.error('Notifications insert w/ sender_id failed:', msg);
      try {
        await db.query('ALTER TABLE Notifications ADD COLUMN sender_id INT NULL');
        // retry insert
        await db.query('INSERT INTO Notifications (user_id, message, is_read, sender_id) VALUES ?', [values]);
      } catch (secondErr) {
        // give up on sender_id; fallback to legacy insert without sender_id
        console.error('Failed to add sender_id or insert after ALTER, falling back to insert without sender_id:', secondErr);
        try {
          const legacyVals = recipients.map(u => [u, message, 0]);
          await db.query('INSERT INTO Notifications (user_id, message, is_read) VALUES ?', [legacyVals]);
        } catch (legacyErr) {
          console.error('Legacy notifications insert also failed:', legacyErr);
          // write to debug file for offline inspection
          try { fs.appendFileSync('./tmp_notifications_errors.log', new Date().toISOString() + ' - notifications insert failed: ' + String(legacyErr) + '\n'); } catch(e){/* ignore */}
          return res.status(500).json({ error: 'Failed to insert notifications' });
        }
      }
    }

    res.json({ message: `Notification sent to ${recipients.length} users.`, recipients_count: recipients.length, sender_id: senderId });
  } catch (err) {
    console.error('notifications.send error', err);
    res.status(500).json({ error: err.message });
  }
});

// Public endpoint: fetch announcements and notifications.
// - If ?user_id=ID is provided, returns notifications for that user (no auth required).
// - If ?all=true is provided, returns all notifications (no auth required) but limited.
// - Default: return the latest public/broadcast announcements (recent notifications) so frontends can show them without authentication.
router.get('/', async (req, res) => {
  try {
    // If a specific user wants their personal notifications, allow fetching by ?user_id=ID
    if (req.query.user_id) {
      const targetId = parseInt(req.query.user_id);
      if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid user_id' });
      const [rows] = await db.query('SELECT notification_id, user_id, message, is_read, created_at, sender_id FROM Notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000', [targetId]);
      const mapped = (rows || []).map(r => ({ id: r.notification_id, user_id: r.user_id, content: r.message, is_read: !!r.is_read, created_at: r.created_at, sender_id: r.sender_id }));
      return res.json(mapped);
    }

    // If ?all=true, return recent notifications (admin-only in prior design). Keep this lightweight and public per user request.
    if (req.query.all === 'true') {
      const [rows] = await db.query('SELECT notification_id, user_id, message, is_read, created_at, sender_id FROM Notifications ORDER BY created_at DESC LIMIT 500');
      const mappedAll = (rows || []).map(r => ({ id: r.notification_id, user_id: r.user_id, content: r.message, is_read: !!r.is_read, created_at: r.created_at, sender_id: r.sender_id }));
      return res.json(mappedAll);
    }

    // Default: return recent broadcast announcements. We interpret broadcast messages as those that were sent to many users.
    // Return latest 100 notifications regardless of recipient so frontends can display public announcements.
    const [rows] = await db.query('SELECT notification_id, user_id, message, is_read, created_at, sender_id FROM Notifications ORDER BY created_at DESC LIMIT 100');
    const mapped = (rows || []).map(r => ({ id: r.notification_id, user_id: r.user_id, content: r.message, is_read: !!r.is_read, created_at: r.created_at, sender_id: r.sender_id }));
    res.json(mapped);
  } catch (err) {
    console.error('notifications.get error', err);
    // write debug info
    try { fs.appendFileSync('./tmp_notifications_errors.log', new Date().toISOString() + ' - notifications.get error: ' + String(err) + '\n'); } catch(e){}
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
