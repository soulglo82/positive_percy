import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from './db.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'positive-percy-secret-dev-only';
const JWT_EXPIRY = '30d';
const REFRESH_TOKEN_EXPIRY_DAYS = 90;
const MAGIC_LINK_EXPIRY_MINUTES = 15;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function signAccountToken(accountId, familyId, familyCode) {
  return jwt.sign(
    { account_id: accountId, family_id: familyId, family_code: familyCode },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function generateMagicToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createRefreshTokenRecord(accountId) {
  const rawToken = generateRefreshToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    'INSERT INTO refresh_tokens (account_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [accountId, tokenHash, expiresAt]
  );

  return rawToken;
}

// Auth middleware that supports both old (family_code only) and new (account_id + family_id) JWT formats
export function accountAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.familyCode = decoded.family_code;
    req.accountId = decoded.account_id || null;
    req.familyId = decoded.family_id || null;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Find or create an account by email, return account + linked families
async function findOrCreateAccount(email, name, authMethod, googleId = null) {
  let account;

  if (googleId) {
    const { rows } = await pool.query('SELECT * FROM accounts WHERE google_id = $1', [googleId]);
    if (rows.length > 0) {
      account = rows[0];
      // Update name if provided and currently empty
      if (name && !account.name) {
        await pool.query('UPDATE accounts SET name = $1 WHERE id = $2', [name, account.id]);
        account.name = name;
      }
      return account;
    }
  }

  // Check by email
  const { rows: emailRows } = await pool.query('SELECT * FROM accounts WHERE email = $1', [email]);
  if (emailRows.length > 0) {
    account = emailRows[0];
    // Link google_id if not yet linked
    if (googleId && !account.google_id) {
      await pool.query('UPDATE accounts SET google_id = $1, auth_method = $2 WHERE id = $3', [googleId, authMethod, account.id]);
      account.google_id = googleId;
    }
    if (name && !account.name) {
      await pool.query('UPDATE accounts SET name = $1 WHERE id = $2', [name, account.id]);
      account.name = name;
    }
    return account;
  }

  // Create new account
  const { rows: newRows } = await pool.query(
    'INSERT INTO accounts (email, name, auth_method, google_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [email, name || null, authMethod, googleId]
  );
  return newRows[0];
}

// Get all families linked to an account
async function getAccountFamilies(accountId) {
  const { rows } = await pool.query(`
    SELECT f.*, af.role, af.joined_at
    FROM account_families af
    JOIN families f ON f.id = af.family_id
    WHERE af.account_id = $1
    ORDER BY af.joined_at ASC
  `, [accountId]);
  return rows;
}

// Issue JWT + refresh token for an account with a specific family
async function issueTokens(account, familyId, familyCode) {
  const accessToken = signAccountToken(account.id, familyId, familyCode);
  const refreshToken = await createRefreshTokenRecord(account.id);
  return { access_token: accessToken, refresh_token: refreshToken };
}

// ─── Google OAuth ────────────────────────────────────────────────────────────

router.post('/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential required' });

    // Verify the Google ID token
    const { OAuth2Client } = await import('google-auth-library');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).json({ error: 'Google OAuth not configured' });

    const client = new OAuth2Client(clientId);
    let ticket;
    try {
      ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    } catch {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    // Find or create account
    const account = await findOrCreateAccount(email, name, 'google', googleId);

    // Get linked families
    const families = await getAccountFamilies(account.id);

    if (families.length === 0) {
      // No family linked yet — return account info without JWT
      // Frontend will prompt to create or join a family
      return res.json({
        account: { id: account.id, email: account.email, name: account.name },
        families: [],
        needs_family: true,
      });
    }

    // Auto-select first family (user can switch later if multi-family supported)
    const family = families[0];
    const tokens = await issueTokens(account, family.id, family.family_code);

    res.json({
      account: { id: account.id, email: account.email, name: account.name },
      families,
      family_code: family.family_code,
      ...tokens,
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ─── Magic Link ──────────────────────────────────────────────────────────────

router.post('/auth/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const rawToken = generateMagicToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

    // Store magic link token
    await pool.query(
      'INSERT INTO magic_link_tokens (email, token_hash, expires_at) VALUES ($1, $2, $3)',
      [normalizedEmail, tokenHash, expiresAt]
    );

    // Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not set — magic link token:', rawToken);
      return res.json({
        success: true,
        message: 'Magic link sent (dev mode — check server logs)',
        // Only include token in dev mode for testing
        ...(process.env.NODE_ENV !== 'production' ? { dev_token: rawToken } : {}),
      });
    }

    const { Resend } = await import('resend');
    const resend = new Resend(resendApiKey);

    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const magicLink = `${baseUrl}/auth/verify/${rawToken}`;

    await resend.emails.send({
      from: 'Positive Percy <noreply@positivepercy.com>',
      to: normalizedEmail,
      subject: 'Sign in to Positive Percy',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #7c3aed;">Sign in to Positive Percy</h2>
          <p>Click the button below to sign in. This link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.</p>
          <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #ec4899); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
            Sign In
          </a>
          <p style="color: #94a3b8; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    res.json({ success: true, message: 'Magic link sent to your email' });
  } catch (err) {
    console.error('Magic link error:', err);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

// Verify magic link token
router.get('/auth/verify/:token', async (req, res) => {
  try {
    const rawToken = req.params.token;
    const tokenHash = hashToken(rawToken);

    const { rows } = await pool.query(
      `SELECT * FROM magic_link_tokens
       WHERE token_hash = $1 AND used = false AND expires_at > NOW()`,
      [tokenHash]
    );

    if (rows.length === 0) {
      // Redirect to login with error
      return res.redirect('/?auth_error=invalid_or_expired_link');
    }

    const magicToken = rows[0];

    // Mark as used (single-use)
    await pool.query('UPDATE magic_link_tokens SET used = true WHERE id = $1', [magicToken.id]);

    // Find or create account
    const account = await findOrCreateAccount(magicToken.email, null, 'magic_link');
    const families = await getAccountFamilies(account.id);

    if (families.length === 0) {
      // Issue a temporary token to complete onboarding (create/join family)
      const tempToken = jwt.sign(
        { account_id: account.id, temp: true },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      return res.redirect(`/?auth_token=${tempToken}&needs_family=true`);
    }

    const family = families[0];
    const tokens = await issueTokens(account, family.id, family.family_code);

    // Redirect to app with tokens
    return res.redirect(`/?auth_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`);
  } catch (err) {
    console.error('Verify magic link error:', err);
    res.redirect('/?auth_error=verification_failed');
  }
});

// ─── Create Family (for newly authenticated accounts without a family) ───────

router.post('/auth/create-family', accountAuthMiddleware, async (req, res) => {
  try {
    const { family_name } = req.body;
    if (!family_name) return res.status(400).json({ error: 'Family name is required' });

    const accountId = req.accountId;
    if (!accountId) return res.status(401).json({ error: 'Account authentication required' });

    // Import generateFamilyCode from routes
    const { generateFamilyCode } = await import('./routes.js');

    let familyCode;
    let familyId;
    let attempts = 0;
    while (attempts < 10) {
      familyCode = generateFamilyCode();
      try {
        const { rows } = await pool.query(
          'INSERT INTO families (family_code, family_name) VALUES ($1, $2) RETURNING *',
          [familyCode, family_name]
        );
        familyId = rows[0].id;

        // Seed default behavior categories
        await pool.query(
          `INSERT INTO behavior_categories (family_code, name, icon, sort_order, is_default) VALUES
            ($1, 'Helpfulness', '🤝', 0, true),
            ($1, 'Kindness', '💛', 1, true),
            ($1, 'Learning', '📚', 2, true),
            ($1, 'Responsibility', '✅', 3, true),
            ($1, 'Creativity', '🎨', 4, true),
            ($1, 'Physical Activity', '🏃', 5, true)
          ON CONFLICT (family_code, name) DO NOTHING`,
          [familyCode]
        );

        break;
      } catch (err) {
        if (err.code === '23505') { attempts++; continue; }
        throw err;
      }
    }
    if (!familyId) return res.status(500).json({ error: 'Could not generate unique family code' });

    // Link account to family as owner
    await pool.query(
      'INSERT INTO account_families (account_id, family_id, role) VALUES ($1, $2, $3)',
      [accountId, familyId, 'owner']
    );

    // Also create legacy users row for backward compat
    const { rows: accountRows } = await pool.query('SELECT email, name FROM accounts WHERE id = $1', [accountId]);
    const acct = accountRows[0];
    await pool.query(
      `INSERT INTO users (email, full_name, family_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET family_code = $3`,
      [acct.email, acct.name || family_name, familyCode]
    ).catch(() => {});

    const tokens = await issueTokens({ id: accountId }, familyId, familyCode);
    res.json({
      family_code: familyCode,
      family_id: familyId,
      ...tokens,
    });
  } catch (err) {
    console.error('Create family error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Join Family (for authenticated accounts) ───────────────────────────────

router.post('/auth/join-family', accountAuthMiddleware, async (req, res) => {
  try {
    const { family_code } = req.body;
    if (!family_code) return res.status(400).json({ error: 'Family code is required' });

    const accountId = req.accountId;
    if (!accountId) return res.status(401).json({ error: 'Account authentication required' });

    const { rows: familyRows } = await pool.query(
      'SELECT * FROM families WHERE family_code = $1',
      [family_code.toUpperCase()]
    );
    if (familyRows.length === 0) {
      return res.status(404).json({ error: 'Family not found. Check the code and try again.' });
    }

    const family = familyRows[0];

    // Check if already linked
    const { rows: existing } = await pool.query(
      'SELECT 1 FROM account_families WHERE account_id = $1 AND family_id = $2',
      [accountId, family.id]
    );
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO account_families (account_id, family_id, role) VALUES ($1, $2, $3)',
        [accountId, family.id, 'member']
      );
    }

    // Also create legacy users row for backward compat
    const { rows: accountRows } = await pool.query('SELECT email, name FROM accounts WHERE id = $1', [accountId]);
    const acct = accountRows[0];
    await pool.query(
      `INSERT INTO users (email, full_name, family_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET family_code = $3`,
      [acct.email, acct.name || '', family.family_code]
    ).catch(() => {});

    const tokens = await issueTokens({ id: accountId }, family.id, family.family_code);
    res.json({
      family_code: family.family_code,
      family_id: family.id,
      ...tokens,
    });
  } catch (err) {
    console.error('Join family error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Refresh Token ───────────────────────────────────────────────────────────

router.post('/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });

    const tokenHash = hashToken(refresh_token);
    const { rows } = await pool.query(
      `SELECT rt.*, a.email, a.name
       FROM refresh_tokens rt
       JOIN accounts a ON a.id = rt.account_id
       WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const rt = rows[0];

    // Revoke old refresh token (rotate)
    await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [rt.id]);

    // Get active family
    const families = await getAccountFamilies(rt.account_id);
    if (families.length === 0) {
      return res.status(400).json({ error: 'No family linked to account' });
    }

    const family = families[0];
    const tokens = await issueTokens({ id: rt.account_id }, family.id, family.family_code);

    res.json({
      account: { id: rt.account_id, email: rt.email, name: rt.name },
      family_code: family.family_code,
      ...tokens,
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ─── Logout ──────────────────────────────────────────────────────────────────

router.post('/auth/logout', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      const tokenHash = hashToken(refresh_token);
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Logout all devices
router.post('/auth/logout-all', accountAuthMiddleware, async (req, res) => {
  try {
    if (!req.accountId) return res.status(401).json({ error: 'Account authentication required' });
    await pool.query('DELETE FROM refresh_tokens WHERE account_id = $1', [req.accountId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Logout all error:', err);
    res.status(500).json({ error: 'Logout all failed' });
  }
});

// ─── Get current account info ────────────────────────────────────────────────

router.get('/auth/account', accountAuthMiddleware, async (req, res) => {
  try {
    if (!req.accountId) {
      // Legacy token — return minimal info from users table
      const { rows } = await pool.query('SELECT * FROM users WHERE family_code = $1', [req.familyCode]);
      if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
      return res.json({ legacy: true, user: rows[0], family_code: req.familyCode });
    }

    const { rows: accountRows } = await pool.query('SELECT * FROM accounts WHERE id = $1', [req.accountId]);
    if (accountRows.length === 0) return res.status(404).json({ error: 'Account not found' });

    const families = await getAccountFamilies(req.accountId);
    res.json({
      account: { id: accountRows[0].id, email: accountRows[0].email, name: accountRows[0].name, auth_method: accountRows[0].auth_method },
      families,
      family_code: req.familyCode,
    });
  } catch (err) {
    console.error('Get account error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Account Deletion (atomic) ───────────────────────────────────────────────

router.delete('/auth/account', accountAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.accountId) return res.status(401).json({ error: 'Account authentication required' });

    await client.query('BEGIN');

    // Get all families this account owns
    const { rows: ownedFamilies } = await client.query(
      `SELECT f.family_code, f.id as family_id
       FROM account_families af
       JOIN families f ON f.id = af.family_id
       WHERE af.account_id = $1 AND af.role = 'owner'`,
      [req.accountId]
    );

    for (const family of ownedFamilies) {
      const fc = family.family_code;
      // Delete all family data
      await client.query('DELETE FROM point_events WHERE family_code = $1', [fc]);
      await client.query('DELETE FROM redemptions WHERE family_code = $1', [fc]);
      await client.query('DELETE FROM children WHERE family_code = $1', [fc]);
      await client.query('DELETE FROM rewards WHERE family_code = $1', [fc]);
      await client.query('DELETE FROM behavior_categories WHERE family_code = $1', [fc]);
      await client.query('DELETE FROM quick_actions WHERE family_code = $1', [fc]);
      await client.query('DELETE FROM family_goals WHERE family_code = $1', [fc]);
      await client.query('DELETE FROM users WHERE family_code = $1', [fc]);
      // Remove all account_families links for this family (including other members)
      await client.query('DELETE FROM account_families WHERE family_id = $1', [family.family_id]);
      // Delete the family itself
      await client.query('DELETE FROM families WHERE id = $1', [family.family_id]);
    }

    // Delete refresh tokens
    await client.query('DELETE FROM refresh_tokens WHERE account_id = $1', [req.accountId]);

    // Delete member-only links (non-owned families)
    await client.query('DELETE FROM account_families WHERE account_id = $1', [req.accountId]);

    // Delete the account
    await client.query('DELETE FROM accounts WHERE id = $1', [req.accountId]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Account and all associated data deleted' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Account deletion failed' });
  } finally {
    client.release();
  }
});

// ─── Data Export ─────────────────────────────────────────────────────────────

router.get('/auth/export', accountAuthMiddleware, async (req, res) => {
  try {
    const familyCode = req.familyCode;
    if (!familyCode) return res.status(400).json({ error: 'No family context' });

    const [family, children, pointEvents, redemptions, rewards, categories, goals] = await Promise.all([
      pool.query('SELECT * FROM families WHERE family_code = $1', [familyCode]),
      pool.query('SELECT * FROM children WHERE family_code = $1 ORDER BY created_date', [familyCode]),
      pool.query('SELECT * FROM point_events WHERE family_code = $1 ORDER BY created_date DESC', [familyCode]),
      pool.query('SELECT * FROM redemptions WHERE family_code = $1 ORDER BY created_date DESC', [familyCode]),
      pool.query('SELECT * FROM rewards WHERE family_code = $1 ORDER BY created_date', [familyCode]),
      pool.query('SELECT * FROM behavior_categories WHERE family_code = $1 ORDER BY sort_order', [familyCode]),
      pool.query('SELECT * FROM family_goals WHERE family_code = $1 ORDER BY created_date', [familyCode]),
    ]);

    // Get account info if available
    let account = null;
    if (req.accountId) {
      const { rows } = await pool.query('SELECT id, email, name, auth_method, created_at FROM accounts WHERE id = $1', [req.accountId]);
      if (rows.length > 0) account = rows[0];
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      account,
      family: family.rows[0] || null,
      children: children.rows,
      point_events: pointEvents.rows,
      redemptions: redemptions.rows,
      rewards: rewards.rows,
      behavior_categories: categories.rows,
      family_goals: goals.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="positive-percy-export-${familyCode}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error('Data export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
