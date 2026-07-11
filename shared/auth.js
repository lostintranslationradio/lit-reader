// shared/auth.js
// Loaded after the Supabase CDN script on every page that needs sign-in.
//
// SETUP: paste your project's URL and anon key below (Supabase dashboard ->
// Project Settings -> API). The anon key is meant to be public and safe to
// ship in client-side code — it has no power on its own without the row-level
// security policies defined in shared/schema.sql.
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

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

async function authSignUp(email, password){
  if(!authConfigured()) throw new Error('not configured');
  const { data, error } = await sb.auth.signUp({ email, password });
  if(error) throw error;
  return data;
}

async function authSignIn(email, password){
  if(!authConfigured()) throw new Error('not configured');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error) throw error;
  return data;
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

function authOnChange(callback){
  if(!sb) return;
  sb.auth.onAuthStateChange((_event, session) => {
    callback(session ? session.user : null);
  });
}

// --- Reusable sign-in/sign-up modal ---
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
  wrap.innerHTML = `
    <div style="background:var(--surface); border:1px solid var(--rule); border-radius:8px;
                max-width:320px; width:100%; padding:24px; font-family:'Inter',sans-serif;">
      <div style="font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.08em;
                  text-transform:uppercase; color:var(--accent); margin-bottom:14px;" id="authModalTitle">Sign in</div>
      <div style="margin-bottom:10px;">
        <input type="email" id="authEmail" placeholder="email" autocomplete="email"
          style="width:100%; background:var(--surface-raised); border:1px solid var(--rule); border-radius:4px;
                 padding:9px 11px; color:var(--text); font-size:13px; outline:none; box-sizing:border-box;">
      </div>
      <div style="margin-bottom:14px;">
        <input type="password" id="authPassword" placeholder="password" autocomplete="current-password"
          style="width:100%; background:var(--surface-raised); border:1px solid var(--rule); border-radius:4px;
                 padding:9px 11px; color:var(--text); font-size:13px; outline:none; box-sizing:border-box;">
      </div>
      <div id="authError" style="color:var(--hsk4); font-size:11px; margin-bottom:10px; display:none;"></div>
      <button id="authSubmit" style="width:100%; font-family:'JetBrains Mono',monospace; font-size:12px;
        padding:10px; border-radius:4px; border:1px solid var(--accent); background:rgba(184,134,58,.14);
        color:var(--accent); cursor:pointer; margin-bottom:10px;">Sign in</button>
      <div style="text-align:center; font-size:11px; color:var(--text-dim);">
        <span id="authToggleText">No account?</span>
        <a href="#" id="authToggleMode" style="color:var(--accent);">Create one</a>
      </div>
      <button id="authClose" style="position:absolute; top:14px; right:16px; background:none; border:none;
        color:var(--text-dim); cursor:pointer; font-size:14px;">✕</button>
    </div>
  `;
  wrap.querySelector('div').style.position = 'relative';
  document.body.appendChild(wrap);

  let mode = 'signin';

  function setMode(m){
    mode = m;
    document.getElementById('authModalTitle').textContent = m === 'signin' ? 'Sign in' : 'Create account';
    document.getElementById('authSubmit').textContent = m === 'signin' ? 'Sign in' : 'Create account';
    document.getElementById('authToggleText').textContent = m === 'signin' ? 'No account?' : 'Already have one?';
    document.getElementById('authToggleMode').textContent = m === 'signin' ? 'Create one' : 'Sign in';
    document.getElementById('authError').style.display = 'none';
  }

  document.getElementById('authToggleMode').addEventListener('click', (e) => {
    e.preventDefault();
    setMode(mode === 'signin' ? 'signup' : 'signin');
  });
  document.getElementById('authClose').addEventListener('click', closeAuthModal);
  wrap.addEventListener('click', (e) => { if(e.target === wrap) closeAuthModal(); });

  document.getElementById('authSubmit').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errEl = document.getElementById('authError');
    errEl.style.display = 'none';
    try{
      const result = mode === 'signin'
        ? await authSignIn(email, password)
        : await authSignUp(email, password);
      closeAuthModal();
      if(window.onAuthSuccess) window.onAuthSuccess(result.user, mode);
    } catch(err){
      errEl.textContent = err.message || 'Something went wrong.';
      errEl.style.display = 'block';
    }
  });
}

function openAuthModal(){
  document.getElementById('authOverlay').style.display = 'flex';
}
function closeAuthModal(){
  document.getElementById('authOverlay').style.display = 'none';
}
