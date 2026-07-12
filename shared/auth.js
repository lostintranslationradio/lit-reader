// shared/auth.js
// Loaded after the Supabase CDN script on every page that needs sign-in.
//
// SETUP: paste your project's URL and anon key below (Supabase dashboard ->
// Project Settings -> API). The anon key is meant to be public and safe to
// ship in client-side code — it has no power on its own without the row-level
// security policies defined in shared/schema.sql.
const SUPABASE_URL = "https://urozuwaidryhduquvtzi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tHobcgdhTkhP18yvEdg79Q_ItYxDVuw";

const sb = (SUPABASE_URL.startsWith('http') && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function authConfigured(){
  if(!sb){
    console.warn('Supabase is not configured yet — set SUPABASE_URL / SUPABASE_ANON_KEY in shared/auth.js');
    return false;
  }
  return true;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Sign-in and "forgot password" both take a username, but Supabase's auth
// API only understands email — this resolves one to the other via a
// security-definer function that can't be used to browse everyone's profile.
async function emailForUsername(username){
  const { data, error } = await sb.rpc('get_login_email', { p_username: username.trim() });
  if(error || !data) return null;
  return data;
}

async function authSignUp(email, username, password){
  if(!authConfigured()) throw new Error('not configured');
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { username } }
  });
  if(error) throw error;
  if(data.user){
    // Best-effort follow-up in case a session is already active (email confirmation off) —
    // the real mechanism is the database trigger reading the metadata above, which works
    // regardless of session state. This second attempt just isn't relied on anymore.
    try{ await authSetUsername(data.user.id, username); }
    catch(unameErr){ console.warn('Username follow-up update skipped:', unameErr.message); }
  }
  return data;
}

async function authSignIn(username, password){
  if(!authConfigured()) throw new Error('not configured');
  const email = await emailForUsername(username);
  if(!email) throw new Error('Incorrect username or password.');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error) throw new Error('Incorrect username or password.');
  return data;
}

async function authRequestPasswordReset(username){
  if(!authConfigured()) throw new Error('not configured');
  const email = await emailForUsername(username);
  // Don't reveal whether the username exists either way — same message regardless.
  if(email){
    await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
  }
}

async function authUpdatePassword(newPassword){
  if(!authConfigured()) throw new Error('not configured');
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if(error) throw error;
}

async function authSignOut(){
  if(!sb) return;
  await sb.auth.signOut();
}

async function authGetUser(){
  if(!sb) return null;
  const { data } = await sb.auth.getUser();
  return data && data.user ? data.user : null;
}

async function authIsCreator(userId){
  if(!sb || !userId) return false;
  const { data, error } = await sb
    .from('profiles')
    .select('is_creator')
    .eq('id', userId)
    .single();
  if(error) return false;
  return !!(data && data.is_creator);
}

async function authGetProfile(userId){
  if(!sb || !userId) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('username, email, is_creator')
    .eq('id', userId)
    .single();
  if(error) return null;
  return data;
}

async function authSetUsername(userId, username){
  if(!authConfigured()) throw new Error('not configured');
  const { error } = await sb.from('profiles').update({ username }).eq('id', userId);
  if(error) throw error;
}

function authOnChange(callback){
  if(!sb) return;
  sb.auth.onAuthStateChange((event, session) => {
    if(event === 'PASSWORD_RECOVERY'){
      if(typeof openAuthModal === 'function') openAuthModal('reset-confirm');
    }
    callback(session ? session.user : null);
  });
}

// --- Reusable sign-in/sign-up/forgot-password modal ---
// Call injectAuthModal() once per page, then openAuthModal() to show it.
// It calls window.onAuthSuccess(user) after a successful sign-in/sign-up,
// which each page defines to do its own thing (reload vocab, check creator status, etc).

function injectAuthModal(){
  const wrap = document.createElement('div');
  wrap.id = 'authOverlay';
  wrap.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.5); display:none;
    align-items:center; justify-content:center; z-index:100; padding:20px;
  `;
  const fieldStyle = `width:100%; background:var(--surface-raised); border:1px solid var(--rule); border-radius:4px;
    padding:9px 11px; color:var(--text); font-size:13px; outline:none; box-sizing:border-box; margin-bottom:10px;`;
  wrap.innerHTML = `
    <div id="authCard" style="background:var(--surface); border:1px solid var(--rule); border-radius:8px;
                max-width:320px; width:100%; padding:24px; font-family:'Inter',sans-serif; position:relative;">
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:14px;">
        <span style="font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.08em;
                    text-transform:uppercase; color:var(--accent);" id="authModalTitle">Sign in</span>
        <span id="authEmailWhy" title="Email used to recover password. Never shown publicly."
          style="display:none; width:13px; height:13px; border-radius:50%; border:1px solid var(--text-dim); color:var(--text-dim);
                 font-size:9px; line-height:11px; text-align:center; cursor:help; flex-shrink:0;">?</span>
      </div>

      <div id="authEmailField" style="display:none;">
        <input type="email" id="authEmail" placeholder="email" autocomplete="email" style="${fieldStyle}">
      </div>

      <input type="text" id="authUsername" placeholder="username" autocomplete="username" style="${fieldStyle}">

      <div id="authPasswordWrap" style="position:relative; margin-bottom:10px;">
        <input type="password" id="authPassword" placeholder="password" autocomplete="current-password"
          style="width:100%; background:var(--surface-raised); border:1px solid var(--rule); border-radius:4px;
                 padding:9px 44px 9px 11px; color:var(--text); font-size:13px; outline:none; box-sizing:border-box;">
        <button type="button" class="authEyeBtn" data-target="authPassword" style="position:absolute; right:8px; top:50%;
          transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--text-dim);
          font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:.03em; padding:2px 4px;">show</button>
      </div>

      <div id="authNewPasswordWrap" style="position:relative; margin-bottom:10px; display:none;">
        <input type="password" id="authNewPassword" placeholder="new password" autocomplete="new-password"
          style="width:100%; background:var(--surface-raised); border:1px solid var(--rule); border-radius:4px;
                 padding:9px 44px 9px 11px; color:var(--text); font-size:13px; outline:none; box-sizing:border-box;">
        <button type="button" class="authEyeBtn" data-target="authNewPassword" style="position:absolute; right:8px; top:50%;
          transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--text-dim);
          font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:.03em; padding:2px 4px;">show</button>
      </div>

      <div id="authError" style="color:var(--hsk4); font-size:11px; margin-bottom:10px; display:none;"></div>
      <div id="authInfo" style="color:var(--accent); font-size:11px; margin-bottom:10px; display:none;"></div>

      <button id="authSubmit" style="width:100%; font-family:'JetBrains Mono',monospace; font-size:12px;
        padding:10px; border-radius:4px; border:1px solid var(--accent); background:rgba(184,134,58,.14);
        color:var(--accent); cursor:pointer; margin-bottom:10px;">Sign in</button>

      <div id="authToggleRow" style="text-align:center; font-size:11px; color:var(--text-dim);">
        <span id="authToggleText">No account?</span>
        <a href="#" id="authToggleMode" style="color:var(--accent);">Create one</a>
      </div>
      <div style="text-align:center; font-size:11px; color:var(--text-dim); margin-top:6px;">
        <a href="#" id="authForgotLink" style="color:var(--text-dim);">Forgot password?</a>
      </div>

      <button id="authClose" style="position:absolute; top:14px; right:16px; background:none; border:none;
        color:var(--text-dim); cursor:pointer; font-size:14px;">✕</button>
    </div>
  `;
  document.body.appendChild(wrap);

  let mode = 'signin';

  function show(id, visible){ document.getElementById(id).style.display = visible ? 'block' : 'none'; }

  function setMode(m){
    mode = m;
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authInfo').style.display = 'none';
    show('authEmailField', m === 'signup');
    document.getElementById('authEmailWhy').style.display = m === 'signup' ? 'inline-block' : 'none';
    show('authUsername', m !== 'reset-confirm');
    show('authPasswordWrap', m === 'signin' || m === 'signup');
    show('authNewPasswordWrap', m === 'reset-confirm');
    document.getElementById('authForgotLink').style.display = m === 'signin' ? 'inline' : 'none';
    document.getElementById('authToggleRow').style.display = (m === 'signin' || m === 'signup') ? 'block' : 'none';

    const titles = { signin: 'Sign in', signup: 'Create account', 'reset-request': 'Reset password', 'reset-confirm': 'Set a new password' };
    const buttons = { signin: 'Sign in', signup: 'Create account', 'reset-request': 'Send reset link', 'reset-confirm': 'Save new password' };
    document.getElementById('authModalTitle').textContent = titles[m];
    document.getElementById('authSubmit').textContent = buttons[m];
    document.getElementById('authToggleText').textContent = m === 'signin' ? 'No account?' : 'Already have one?';
    document.getElementById('authToggleMode').textContent = m === 'signin' ? 'Create one' : 'Sign in';
  }

  wrap.querySelectorAll('.authEyeBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const revealing = input.type === 'password';
      input.type = revealing ? 'text' : 'password';
      btn.textContent = revealing ? 'hide' : 'show';
    });
  });

  document.getElementById('authToggleMode').addEventListener('click', (e) => {
    e.preventDefault();
    setMode(mode === 'signin' ? 'signup' : 'signin');
  });
  document.getElementById('authForgotLink').addEventListener('click', (e) => {
    e.preventDefault();
    setMode('reset-request');
  });
  document.getElementById('authClose').addEventListener('click', closeAuthModal);
  wrap.addEventListener('click', (e) => { if(e.target === wrap) closeAuthModal(); });

  document.getElementById('authSubmit').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const newPassword = document.getElementById('authNewPassword').value;
    const errEl = document.getElementById('authError');
    const infoEl = document.getElementById('authInfo');
    errEl.style.display = 'none';
    infoEl.style.display = 'none';

    if((mode === 'signin' || mode === 'signup' || mode === 'reset-request') && !USERNAME_RE.test(username)){
      errEl.textContent = 'Username: 3-20 letters, numbers, or underscores.';
      errEl.style.display = 'block';
      return;
    }

    try{
      if(mode === 'signin'){
        const result = await authSignIn(username, password);
        closeAuthModal();
        if(window.onAuthSuccess) window.onAuthSuccess(result.user, mode);
      } else if(mode === 'signup'){
        const result = await authSignUp(email, username, password);
        if(result.session){
          closeAuthModal();
          if(window.onAuthSuccess) window.onAuthSuccess(result.user, mode);
        } else {
          infoEl.textContent = 'Account created — check your inbox to confirm your email before signing in.';
          infoEl.style.display = 'block';
        }
      } else if(mode === 'reset-request'){
        await authRequestPasswordReset(username);
        infoEl.textContent = 'If that username exists, a reset link was sent to its email.';
        infoEl.style.display = 'block';
      } else if(mode === 'reset-confirm'){
        if(newPassword.length < 6){
          errEl.textContent = 'Password should be at least 6 characters.';
          errEl.style.display = 'block';
          return;
        }
        await authUpdatePassword(newPassword);
        closeAuthModal();
        alert('Password updated \u2014 you\u2019re signed in.');
        if(window.onAuthSuccess){
          const user = await authGetUser();
          window.onAuthSuccess(user, mode);
        }
      }
    } catch(err){
      errEl.textContent = err.message || 'Something went wrong.';
      errEl.style.display = 'block';
    }
  });

  injectAuthModal.setMode = setMode;
}

function openAuthModal(mode){
  document.getElementById('authOverlay').style.display = 'flex';
  if(injectAuthModal.setMode) injectAuthModal.setMode(mode || 'signin');
}
function closeAuthModal(){
  document.getElementById('authOverlay').style.display = 'none';
}
