import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { supabaseConfig } from './config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = {
  db: null, user: null, session: null, profile: null, workspace: null, role: null,
  workspaces: [], activeWorkspaceId: '', reviews: [], sources: [], members: [], events: [], comments: [],
  memberProfiles: {}, currentReview: null, authMode: 'signin', pendingAgent: null,
  loading: false, edgeAvailable: false, reducedMotion: false, demoMode: false
};

async function invokeAgent37(body) {
  if (!state.db) throw new Error('Supabase is not configured.');
  const { data: sessionData, error: sessionError } = await state.db.auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Your sign-in session has expired. Sign in again.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 58000);
  try {
    const response = await fetch('/api/agent-37', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) throw new Error(data?.error || `Agent 37 returned HTTP ${response.status}.`);
    return { data, error: null };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Agent 37 timed out after 58 seconds. Please try again.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

const featureHelp = {
  overview: 'Overview displays only live counts and records from the active workspace. It stays empty until you create a workspace and add real data.',
  reviews: 'The review queue stores drafts, source-based findings, comments and reviewer decisions. Agent 37 can analyse text after its secure Vercel API is configured.',
  sources: 'The source library stores approved facts, policies, terminology and brand rules. The AI can only cite sources that belong to the active workspace.',
  insights: 'Insights aggregate the findings stored with real review records. The page does not generate sample analytics.',
  team: 'Team & roles shows actual workspace members. Creator, reviewer, brand owner and admin roles have different permissions.',
  history: 'Audit history shows events recorded against real review and source activity. Production compliance deployments should add trusted server-side audit triggers.',
  settings: 'Settings lets you update your display name, appearance and account preferences.',
  guide: 'The feature guide explains each part of BASE, what it does and which safeguards apply.'
};

const configUrl = String(supabaseConfig?.url || '').trim();
const configKey = String(supabaseConfig?.anonKey || '').trim();
const configured = Boolean(
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(configUrl) &&
  configKey.length > 20 &&
  !/YOUR_|PASTE_/i.test(configKey) &&
  !configKey.startsWith('sb_secret_')
);

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
function initials(value = '') {
  return String(value).trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'U';
}
function niceDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function relativeDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return niceDate(value);
}
function toast(message, kind = 'info') {
  const node = $('#toast');
  node.textContent = message;
  node.dataset.kind = kind;
  node.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => node.classList.remove('show'), 3400);
}
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  const focusable = $('input,textarea,button,select', modal);
  window.setTimeout(() => focusable?.focus(), 40);
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (!$('.modal-backdrop.open')) document.body.classList.remove('modal-open');
}
function showGuestOrSignIn(message = '') {
  if (message) $('#authNotice').textContent = message;
  openModal('authModal');
}
function requireUser() {
  if (!state.user) {
    showGuestOrSignIn('Sign in to create or change workspace data. Guest demo records are illustrative and never saved to your account.');
    return false;
  }
  if (!state.workspace) {
    toast('Create or join a workspace before using this feature.', 'warning');
    openModal('workspaceModal');
    return false;
  }
  return true;
}
function getDisplayName() {
  return state.profile?.username || state.user?.user_metadata?.username || state.user?.user_metadata?.full_name || state.user?.email?.split('@')[0] || 'Account';
}
function currentRoleCanManageSources() { return ['admin', 'brand_owner'].includes(state.role); }
function currentRoleCanReview() { return ['admin', 'brand_owner', 'reviewer'].includes(state.role); }

function go(view) {
  const target = document.getElementById(view);
  if (!target) return;
  $$('.view').forEach(section => section.classList.toggle('active', section.id === view));
  $$('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('#breadcrumb').textContent = view === 'guide' ? 'Feature guide' : view[0].toUpperCase() + view.slice(1);
  $('#sidebar').classList.remove('open');
  if (!state.reducedMotion) window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'settings') fillSettings();
  if (view === 'insights') renderInsights();
  if (view === 'team') renderMembers();
}
$$('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => go(button.dataset.view)));
$$('[data-go]').forEach(button => button.addEventListener('click', () => go(button.dataset.go)));
$$('[data-guide-go]').forEach(button => button.addEventListener('click', () => go(button.dataset.guideGo)));
$('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#profileButton').addEventListener('click', () => state.user ? go('settings') : showGuestOrSignIn());
$('#topAuthButton').addEventListener('click', () => state.user ? $('#signOutButton').click() : showGuestOrSignIn());
$('#previewSignIn').addEventListener('click', () => showGuestOrSignIn());
$('#workspaceSwitch').addEventListener('click', () => {
  if (!state.user) return showGuestOrSignIn();
  if (!state.workspaces.length) return openModal('workspaceModal');
  renderWorkspaceSwitcher();
  openModal('workspaceSwitchModal');
});
$('#switchCreateWorkspace').addEventListener('click', () => {
  closeModal('workspaceSwitchModal');
  openModal('workspaceModal');
});
$('#workspaceOptions').addEventListener('click', async event => {
  const button = event.target.closest('[data-workspace-id]');
  if (!button || button.dataset.workspaceId === state.workspace?.id) return closeModal('workspaceSwitchModal');
  const nextId = button.dataset.workspaceId;
  button.disabled = true; button.classList.add('is-loading');
  try {
    state.activeWorkspaceId = nextId;
    try { window.localStorage.setItem(`base-active-workspace:${state.user.id}`, nextId); } catch {}
    await loadWorkspace();
    renderAll(); closeModal('workspaceSwitchModal');
    toast(`Switched to ${state.workspace.name}.`, 'success');
  } catch (error) {
    toast(`Could not switch workspace: ${error.message}`, 'error');
    button.disabled = false; button.classList.remove('is-loading');
  }
});

// Guest demo uses clearly-labelled in-memory sample records. Nothing is written to Supabase.
function setGuestState(demo = false) {
  state.user = null; state.session = null; state.profile = null; state.workspace = null; state.role = null;
  state.workspaces = []; state.activeWorkspaceId = '';
  state.reviews = []; state.sources = []; state.members = []; state.events = []; state.memberProfiles = {};
  state.demoMode = Boolean(demo);
  $('#publicLanding').hidden = false;
  $('#previewBanner').hidden = false;
  $('#connectionState').innerHTML = `<i></i> ${demo ? 'Guest demo' : 'Preview mode'}`;
  $('#connectionState').classList.remove('connected');
  $('#workspaceName').textContent = demo ? 'BASE sample workspace' : 'Guest preview';
  $('#workspaceMeta').textContent = demo ? 'Illustrative data · local only' : 'No workspace connected';
  $('#userName').textContent = demo ? 'Guest explorer' : 'Guest preview';
  $('#userState').textContent = demo ? 'Exploring sample data · no account' : 'Browsing without an account';
  $('#userAvatar').textContent = 'G';
  $('#topAuthButton').textContent = 'Sign in';
  document.body.classList.add('is-guest');
  if (demo) {
    const now = Date.now();
    const ago = hours => new Date(now - hours * 3600000).toISOString();
    state.workspace = { id: 'guest-demo-workspace', name: 'BASE sample workspace' };
    state.role = 'admin';
    state.memberProfiles = {
      'demo-creator': { username: 'Maya Chen' },
      'demo-reviewer': { username: 'Jordan Lee' },
      'demo-owner': { username: 'Alex Morgan' }
    };
    state.reviews = [
      { id: 'demo-review-1', title: 'Spring product launch announcement', channel: 'Website', owner_uid: 'demo-creator', status: 'Needs review', created_at: ago(3), updated_at: ago(1), content: 'Our new collection is the most sustainable range on the market. It is made with 100% recycled materials and is guaranteed to last a lifetime.', findings: [
        { severity: 'high', category: 'Unsupported superlative', finding: '“The most sustainable range on the market” makes a comparative claim without evidence covering the wider market.', suggestion: 'Replace the superlative with a specific, substantiated product attribute.' },
        { severity: 'medium', category: 'Product claim', finding: 'The 100% recycled-material claim needs an approved specification or supplier record.', suggestion: 'Cite the current materials specification and confirm whether all components are covered.' },
        { severity: 'medium', category: 'Guarantee wording', finding: '“Guaranteed to last a lifetime” may imply a formal lifetime warranty.', suggestion: 'Use approved warranty wording and link to the applicable terms.' }
      ] },
      { id: 'demo-review-2', title: 'Customer onboarding email', channel: 'Email', owner_uid: 'demo-creator', status: 'In progress', created_at: ago(27), updated_at: ago(5), content: 'Welcome to Northstar. Your account is ready. Our support team is available around the clock to help you get started.', findings: [
        { severity: 'low', category: 'Service availability', finding: '“Around the clock” should be checked against the approved support-hours policy.', suggestion: 'State the confirmed support hours and the available contact channel.' }
      ] },
      { id: 'demo-review-3', title: 'Partner campaign social copy', channel: 'LinkedIn', owner_uid: 'demo-creator', status: 'Approved', created_at: ago(78), updated_at: ago(31), content: 'Built for teams that value clarity. Explore the Northstar platform and see how a transparent workflow keeps every decision connected to its source.', findings: [] }
    ];
    state.sources = [
      { id: 'demo-source-1', name: 'Approved product facts', source_type: 'Approved fact', body: 'The Northstar platform helps teams organise reviews, approved sources and decision history in one workspace. Avoid claims of market leadership unless a current comparative study is approved.', owner_id: 'demo-owner', review_due: null },
      { id: 'demo-source-2', name: 'Sustainability claims policy', source_type: 'Policy', body: 'Environmental claims must be specific, current, and supported by approved evidence. Broad claims such as “green”, “eco-friendly”, or “most sustainable” require substantiation and context.', owner_id: 'demo-owner', review_due: null },
      { id: 'demo-source-3', name: 'Customer support wording', source_type: 'Brand guideline', body: 'Describe customer support availability using the published service hours. Do not use “24/7” or “around the clock” unless the service schedule explicitly confirms continuous availability.', owner_id: 'demo-owner', review_due: null },
      { id: 'demo-source-4', name: 'Brand voice and tone', source_type: 'Terminology', body: 'Use clear, calm, confident language. Prefer precise product descriptions over superlatives. Explain what the product helps people do rather than promising an outcome.', owner_id: 'demo-owner', review_due: null }
    ];
    state.members = [
      { user_id: 'demo-owner', role: 'admin', joined_at: ago(24 * 50) },
      { user_id: 'demo-reviewer', role: 'reviewer', joined_at: ago(24 * 35) },
      { user_id: 'demo-creator', role: 'creator', joined_at: ago(24 * 20) }
    ];
    state.events = [
      { event_type: 'review_approved', actor_uid: 'demo-reviewer', created_at: ago(31), details: { title: 'Partner campaign social copy' } },
      { event_type: 'finding_comment_added', actor_uid: 'demo-reviewer', created_at: ago(5), details: { title: 'Customer onboarding email', comment: 'Please confirm the published support hours.' } },
      { event_type: 'review_submitted', actor_uid: 'demo-creator', created_at: ago(3), details: { title: 'Spring product launch announcement' } },
      { event_type: 'source_updated', actor_uid: 'demo-owner', created_at: ago(24), details: { name: 'Sustainability claims policy' } }
    ];
    $('#previewBanner').innerHTML = '<span class="preview-dot"></span><div><b>Guest demo · illustrative sample data</b><p>Explore the workflow with example records. Changes are not saved; sign in to create and manage your own private workspace.</p></div><button class="text-button" id="previewSignIn">Create account →</button>';
    $('#previewSignIn').addEventListener('click', () => showGuestOrSignIn());
  } else {
    $('#previewBanner').innerHTML = '<span class="preview-dot"></span><div><b>Guest preview · no workspace connected</b><p>Explore the feature guide, or open the guest demo to inspect example reviews, approved sources and insights.</p></div><button class="text-button" id="previewSignIn">Sign in →</button>';
    $('#previewSignIn').addEventListener('click', () => showGuestOrSignIn());
  }
  $('#supabaseConnection').textContent = configured ? 'Connected · signed out' : 'Not configured';
  $('#supabaseConnection').className = `status-pill ${configured ? 'success' : 'neutral'}`;
  $('#agentConnection').textContent = 'Sign in to connect';
  document.body.classList.toggle('workspace-open', Boolean(demo));
  renderAll();
}
function enterGuestDemo(targetView = 'overview') {
  setGuestState(true);
  if (targetView && targetView !== 'overview') go(targetView);
  window.scrollTo({ top: 0, behavior: state.reducedMotion ? 'auto' : 'smooth' });
}

async function initialise() {
  loadPreferences();
  bindStaticControls();
  if (!configured) {
    setGuestState();
    const missing = !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(configUrl)
      ? 'Project URL'
      : (!configKey || /YOUR_|PASTE_/i.test(configKey) ? 'Publishable key' : 'Valid Supabase credentials');
    $('#authNotice').textContent = `Add your Supabase ${missing} in config.js to enable Google and email sign-in. The guest preview remains available without sample records.`;
    $('#supabaseConnection').textContent = `Missing ${missing}`;
    return;
  }
  try {
    state.db = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    $('#supabaseConnection').textContent = 'Configured';
    $('#supabaseConnection').className = 'status-pill success';
    const { data: { session }, error } = await state.db.auth.getSession();
    if (error) throw error;
    await handleSession(session);
    state.db.auth.onAuthStateChange((_event, nextSession) => {
      // Avoid Supabase auth callback lock contention by deferring database work.
      window.setTimeout(() => handleSession(nextSession), 0);
    });
  } catch (error) {
    console.error('BASE initialisation failed:', error);
    setGuestState();
    toast(`Connection issue: ${error.message || 'Could not initialise Supabase.'}`, 'error');
  }
}

async function handleSession(session) {
  state.session = session || null;
  state.user = session?.user || null;
  if (!state.user) {
    setGuestState(false);
    return;
  }
  state.demoMode = false;
  document.body.classList.add('workspace-open');
  $('#publicLanding').hidden = true;
  $('#previewBanner').hidden = true;
  $('#connectionState').innerHTML = '<i></i> Connected';
  $('#connectionState').classList.add('connected');
  $('#topAuthButton').textContent = 'Sign out';
  document.body.classList.remove('is-guest');
  $('#userName').textContent = getDisplayName();
  $('#userState').textContent = state.user.email || 'Signed in';
  $('#userAvatar').textContent = initials(getDisplayName());
  $('#welcomeTitle').textContent = `Welcome back, ${getDisplayName().split(' ')[0]}.`;
  try {
    await ensureProfile();
    await state.db.rpc('accept_pending_workspace_invitations');
    await loadWorkspace();
  } catch (error) {
    console.error('Could not load workspace:', error);
    toast(`Could not load workspace: ${error.message || 'Check database setup and access policies.'}`, 'error');
  }
  renderAll();
}

async function ensureProfile() {
  const { data, error } = await state.db.from('profiles').select('*').eq('user_id', state.user.id).maybeSingle();
  if (error) throw error;
  if (data) {
    state.profile = data;
    return;
  }
  const username = state.user.user_metadata?.username || state.user.user_metadata?.full_name || state.user.email?.split('@')[0] || 'New member';
  const { data: inserted, error: insertError } = await state.db.from('profiles')
    .upsert({ user_id: state.user.id, username }, { onConflict: 'user_id' }).select().single();
  if (insertError) throw insertError;
  state.profile = inserted;
}

async function loadWorkspace() {
  const { data: memberships, error } = await state.db.from('workspace_members')
    .select('workspace_id,role,joined_at').eq('user_id', state.user.id).order('joined_at', { ascending: true });
  if (error) throw error;
  if (!memberships?.length) {
    state.workspace = null; state.role = null; state.workspaces = []; state.activeWorkspaceId = '';
    state.reviews = []; state.sources = []; state.members = []; state.events = []; state.memberProfiles = {};
    $('#workspaceName').textContent = 'No workspace yet';
    $('#workspaceMeta').textContent = 'Create one to get started';
    openWorkspacePromptIfNeeded();
    return;
  }
  const workspaceIds = memberships.map(item => item.workspace_id);
  const { data: workspaceRows, error: workspaceError } = await state.db.from('workspaces')
    .select('*').in('id', workspaceIds);
  if (workspaceError) throw workspaceError;
  const rowsById = new Map((workspaceRows || []).map(row => [row.id, row]));
  state.workspaces = memberships.map(member => ({
    ...rowsById.get(member.workspace_id), role: member.role, joined_at: member.joined_at,
  })).filter(item => item.id);
  let preferredId = state.activeWorkspaceId || state.workspace?.id || '';
  try { preferredId = preferredId || window.localStorage.getItem(`base-active-workspace:${state.user.id}`) || ''; } catch {}
  const membership = state.workspaces.find(item => item.id === preferredId) || state.workspaces[0];
  state.activeWorkspaceId = membership.id;
  try { window.localStorage.setItem(`base-active-workspace:${state.user.id}`, membership.id); } catch {}
  state.role = membership.role;
  state.workspace = membership;
  $('#workspaceName').textContent = membership.name;
  $('#workspaceMeta').textContent = `${membership.role.replace('_', ' ')} · ${state.workspaces.length} workspace${state.workspaces.length === 1 ? '' : 's'}`;
  await loadWorkspaceData();
}

function renderWorkspaceSwitcher() {
  const container = $('#workspaceOptions');
  container.replaceChildren();
  $('#workspaceCountLabel').textContent = `${state.workspaces.length} available`;
  state.workspaces.forEach(workspace => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `workspace-option${workspace.id === state.workspace?.id ? ' active' : ''}`;
    button.dataset.workspaceId = workspace.id;
    const mark = document.createElement('span'); mark.className = 'workspace-option-mark'; mark.textContent = (workspace.name || 'W').slice(0, 1).toUpperCase();
    const copy = document.createElement('span'); copy.className = 'workspace-option-copy';
    const title = document.createElement('b'); title.textContent = workspace.name;
    const meta = document.createElement('small'); meta.textContent = workspace.role.replaceAll('_', ' ');
    copy.append(title, meta);
    const status = document.createElement('span'); status.className = 'workspace-option-status';
    status.textContent = workspace.id === state.workspace?.id ? 'Current' : 'Switch';
    button.append(mark, copy, status); container.append(button);
  });
}

function openWorkspacePromptIfNeeded() {
  $('#workspaceName').textContent = 'No workspace yet';
  $('#workspaceMeta').textContent = 'Create one to get started';
  const button = $('#setupSteps');
  if (button) button.innerHTML = `<div class="setup-step"><span>01</span><div><b>Create your workspace</b><small>Set up a private home for your team.</small></div><button class="mini-action" id="setupCreateWorkspace">Create →</button></div>`;
  $('#workspaceModal').classList.remove('open');
}

async function loadWorkspaceData() {
  if (!state.workspace || !state.db) return;
  const wid = state.workspace.id;
  const [reviewsResult, sourcesResult, membersResult, eventsResult] = await Promise.all([
    state.db.from('reviews').select('*').eq('workspace_id', wid).order('updated_at', { ascending: false }),
    state.db.from('brand_sources').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }),
    state.db.from('workspace_members').select('user_id,role,joined_at').eq('workspace_id', wid).order('joined_at', { ascending: true }),
    state.db.from('review_events').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }).limit(100)
  ]);
  for (const result of [reviewsResult, sourcesResult, membersResult, eventsResult]) if (result.error) throw result.error;
  state.reviews = reviewsResult.data || [];
  state.sources = sourcesResult.data || [];
  state.members = membersResult.data || [];
  state.events = eventsResult.data || [];
  const profileIds = [...new Set([
    ...state.members.map(member => member.user_id),
    ...state.reviews.map(review => review.owner_uid).filter(Boolean),
    ...state.events.map(event => event.actor_uid).filter(Boolean)
  ])];
  state.memberProfiles = {};
  if (profileIds.length) {
    const { data: profiles, error } = await state.db.from('profiles').select('user_id,username,avatar_url').in('user_id', profileIds);
    if (error) throw error;
    (profiles || []).forEach(profile => { state.memberProfiles[profile.user_id] = profile; });
  }
}

function renderAll() {
  renderOverview(); renderReviews(); renderSources(); renderInsights(); renderMembers(); renderHistory(); fillSettings();
}
function renderOverview() {
  const authenticated = Boolean(state.user);
  const countsAvailable = Boolean(state.workspace);
  $('#metricReviews').textContent = countsAvailable ? state.reviews.length : (authenticated ? '0' : '—');
  $('#metricOpen').textContent = countsAvailable ? state.reviews.filter(review => review.status !== 'Approved').length : (authenticated ? '0' : '—');
  $('#metricSources').textContent = countsAvailable ? state.sources.length : (authenticated ? '0' : '—');
  $('#metricMembers').textContent = countsAvailable ? state.members.length : (authenticated ? '0' : '—');
  $('#queueCount').textContent = countsAvailable ? state.reviews.filter(review => review.status !== 'Approved').length : '0';
  const recent = $('#recentReviews');
  if (!state.reviews.length) {
    recent.innerHTML = `<div class="inline-empty"><span>▤</span><b>${state.workspace ? 'No reviews yet' : state.user ? 'Create your workspace first' : 'No preview records'}</b><p>${state.workspace ? "Your team's real review submissions will appear here." : state.user ? 'Create a workspace to begin saving reviews and sources.' : 'Open the guest demo to browse example reviews, approved sources and insights. Sample records are not saved.'}</p>${state.workspace ? '<button class="text-button require-auth" id="emptyStartReview">Create your first review →</button>' : state.user ? '<button class="text-button" id="emptyCreateWorkspace">Create workspace →</button>' : '<button class="text-button" id="emptySignIn">Sign in to begin →</button>'}</div>`;
  } else {
    recent.innerHTML = state.reviews.slice(0, 5).map(review => `<button class="recent-item" data-review-id="${esc(review.id)}"><span class="recent-file">▤</span><span class="recent-main"><b>${esc(review.title)}</b><small>${esc(profileName(review.owner_uid))} · ${esc(review.channel || 'Unspecified channel')} · ${relativeDate(review.updated_at || review.created_at)}</small></span><span class="status-tag ${statusClass(review.status)}">${esc(review.status)}</span></button>`).join('');
    $$('[data-review-id]', recent).forEach(button => button.addEventListener('click', () => openReviewDetail(button.dataset.reviewId)));
  }
  renderSetupSteps();
  $('#welcomeTitle').textContent = state.user ? `Welcome back, ${getDisplayName().split(' ')[0]}.` : 'A clear view of your brand.';
}
function renderSetupSteps() {
  let steps;
  if (!state.user) {
    steps = [
      ['01', 'Connect your account', 'Sign in with Google or email to keep your data private.', 'Sign in', 'auth'],
      ['02', 'Create a workspace', 'Set the boundary for your team and records.', 'Learn more', 'guide'],
      ['03', 'Add approved sources', 'Give reviews a trustworthy evidence base.', 'Explore', 'sources']
    ];
  } else if (!state.workspace) {
    steps = [['01', 'Create your workspace', 'You become its first administrator.', 'Create', 'workspace'], ['02', 'Invite your team', 'Add creators, reviewers and brand owners.', 'Learn', 'team'], ['03', 'Add approved sources', 'Start with the facts and policies your team trusts.', 'Learn', 'sources']];
  } else {
    steps = [
      [state.sources.length ? '✓' : '01', 'Add approved sources', state.sources.length ? `${state.sources.length} source(s) are in the library.` : 'Add your first approved fact or guideline.', state.sources.length ? 'Open' : 'Add', 'sources'],
      [state.members.length > 1 ? '✓' : '02', 'Bring in your team', state.members.length > 1 ? `${state.members.length} members have access.` : 'Invite a reviewer or brand owner.', 'Open', 'team'],
      [state.reviews.length ? '✓' : '03', 'Submit a content review', state.reviews.length ? `${state.reviews.length} review(s) saved.` : 'Run your first source-backed content check.', state.reviews.length ? 'Open' : 'Start', 'reviews']
    ];
  }
  $('#setupSteps').innerHTML = steps.map(([number, title, description, action, target]) => `<div class="setup-step"><span class="step-number ${number === '✓' ? 'complete' : ''}">${number}</span><div><b>${esc(title)}</b><small>${esc(description)}</small></div><button class="mini-action" data-setup-target="${target}">${esc(action)} →</button></div>`).join('');
  $$('[data-setup-target]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.setupTarget === 'auth') showGuestOrSignIn();
    else if (button.dataset.setupTarget === 'workspace') openModal('workspaceModal');
    else go(button.dataset.setupTarget);
  }));
  $('#setupCreateWorkspace')?.addEventListener('click', () => openModal('workspaceModal'));
  $('#emptyStartReview')?.addEventListener('click', () => openModal('reviewModal'));
  $('#emptyCreateWorkspace')?.addEventListener('click', () => openModal('workspaceModal'));
  $('#emptySignIn')?.addEventListener('click', () => showGuestOrSignIn());
}
function profileName(userId) {
  if (!userId) return 'Unknown member';
  if (userId === state.user?.id) return getDisplayName();
  return state.memberProfiles[userId]?.username || 'Workspace member';
}
function statusClass(status) {
  return ({ 'Approved': 'success', 'In progress': 'info', 'Changes requested': 'warning', 'On hold': 'muted' })[status] || 'pending';
}
function reviewSeverity(review) {
  const findings = Array.isArray(review.findings) ? review.findings : [];
  const severities = findings.map(item => String(item.severity || '').toLowerCase());
  if (severities.includes('high')) return 'High';
  if (severities.includes('medium')) return 'Medium';
  if (findings.length) return 'Low';
  return '—';
}
function renderReviews() {
  const query = ($('#reviewSearch')?.value || '').trim().toLowerCase();
  const status = $('#reviewStatusFilter')?.value || 'all';
  const priority = $('#reviewPriorityFilter')?.value || 'all';
  const matching = state.reviews.filter(review => {
    const text = [review.title, review.channel, profileName(review.owner_uid)].join(' ').toLowerCase();
    return text.includes(query) && (status === 'all' || review.status === status) && (priority === 'all' || reviewSeverity(review) === priority);
  });
  $('#reviewTableBody').innerHTML = matching.map(review => `<tr><td><b>${esc(review.title)}</b><small>${esc(review.channel || 'Unspecified channel')}</small></td><td>${esc(profileName(review.owner_uid))}</td><td><span class="finding-count">${Array.isArray(review.findings) ? review.findings.length : 0}</span><small>${esc(reviewSeverity(review))} priority</small></td><td><span class="status-tag ${statusClass(review.status)}">${esc(review.status)}</span></td><td>${esc(relativeDate(review.updated_at || review.created_at))}</td><td><button class="text-button" data-open-review="${esc(review.id)}">Open →</button></td></tr>`).join('');
  $$('[data-open-review]').forEach(button => button.addEventListener('click', () => openReviewDetail(button.dataset.openReview)));
  $('#reviewEmpty').innerHTML = matching.length ? '' : `<div class="inline-empty"><span>▤</span><b>${state.reviews.length ? 'No matching reviews' : 'Your review queue is clear'}</b><p>${state.reviews.length ? 'Try a different search or filter.' : state.workspace ? 'When you submit a draft, it will appear here with its current status and findings.' : state.user ? 'Create a workspace before submitting content.' : 'Guest preview has no sample review records. Sign in to create and save real reviews.'}</p>${state.workspace ? '<button class="button button-primary require-auth" id="queueCreateReview">＋ Create a review</button>' : state.user ? '<button class="button button-primary" id="queueCreateWorkspace">Create workspace</button>' : '<button class="button button-primary" id="queueSignIn">Sign in</button>'}</div>`;
  $('#queueCreateReview')?.addEventListener('click', () => openModal('reviewModal'));
  $('#queueCreateWorkspace')?.addEventListener('click', () => openModal('workspaceModal'));
  $('#queueSignIn')?.addEventListener('click', () => showGuestOrSignIn());
}
function renderSources() {
  const query = ($('#sourceSearch')?.value || '').trim().toLowerCase();
  const matching = state.sources.filter(source => [source.name, source.source_type, source.body].join(' ').toLowerCase().includes(query));
  $('#sourceCount').textContent = `${state.sources.length} source${state.sources.length === 1 ? '' : 's'}`;
  $('#sourceGrid').innerHTML = matching.map(source => `<article class="source-card"><div class="source-card-top"><span class="source-symbol">◈</span><span class="source-type">${esc(source.source_type)}</span></div><h3>${esc(source.name)}</h3><p>${esc(String(source.body || '').slice(0, 230))}${String(source.body || '').length > 230 ? '…' : ''}</p><div class="source-meta"><span>Owner: ${esc(profileName(source.owner_id))}</span><span>${source.review_due ? `Review by ${esc(new Date(source.review_due).toLocaleDateString())}` : 'No review date'}</span></div></article>`).join('');
  $('#sourceEmpty').innerHTML = matching.length ? '' : `<div class="inline-empty"><span>◈</span><b>${state.sources.length ? 'No matching sources' : 'No approved sources yet'}</b><p>${state.sources.length ? 'Try another search.' : state.workspace ? 'Add approved facts, guidelines or terminology. Until then, Agent 37 will not claim to have evidence.' : state.user ? 'Create a workspace before adding sources.' : 'Browse the guest demo to inspect example approved facts, policies and brand guidance.'}</p>${state.workspace && currentRoleCanManageSources() ? '<button class="button button-primary" id="sourceEmptyAdd">＋ Add a source</button>' : state.user && !state.workspace ? '<button class="button button-primary" id="sourceEmptyWorkspace">Create workspace</button>' : !state.user ? '<button class="button button-primary" id="sourceEmptySignIn">Sign in</button>' : ''}</div>`;
  $('#sourceEmptyAdd')?.addEventListener('click', () => openModal('sourceModal'));
  $('#sourceEmptyWorkspace')?.addEventListener('click', () => openModal('workspaceModal'));
  $('#sourceEmptySignIn')?.addEventListener('click', () => showGuestOrSignIn());
}
function renderInsights() {
  const findings = state.reviews.flatMap(review => Array.isArray(review.findings) ? review.findings : []);
  const categories = {};
  findings.forEach(finding => {
    const category = finding.category || 'Uncategorised';
    categories[category] = (categories[category] || 0) + 1;
  });
  const high = findings.filter(finding => String(finding.severity || '').toLowerCase() === 'high').length;
  $('#insightHigh').textContent = state.workspace ? high : '—';
  $('#insightResolved').textContent = state.workspace ? state.reviews.filter(review => review.status === 'Approved').length : '—';
  $('#insightCategories').textContent = state.workspace ? Object.keys(categories).length : '—';
  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  $('#insightBars').innerHTML = entries.length ? entries.map(([name, count]) => `<div class="bar-item"><div><span>${esc(name)}</span><b>${count}</b></div><i><u style="width:${Math.max(5, count / Math.max(...entries.map(entry => entry[1])) * 100)}%"></u></i></div>`).join('') : `<div class="inline-empty"><span>⌁</span><b>No finding trends yet</b><p>${state.workspace ? 'Once reviews contain structured findings, category and severity trends will appear here.' : 'Sign in and create a workspace to view your real data.'}</p></div>`;
}
function renderMembers() {
  $('#memberCount').textContent = `${state.members.length} member${state.members.length === 1 ? '' : 's'}`;
  $('#memberList').innerHTML = state.members.map(member => {
    const profile = state.memberProfiles[member.user_id] || {};
    const name = member.user_id === state.user?.id ? getDisplayName() : profile.username || 'Workspace member';
    return `<div class="member-row"><span class="avatar">${esc(initials(name))}</span><div class="member-info"><b>${esc(name)}${member.user_id === state.user?.id ? ' (you)' : ''}</b><small>Joined ${esc(niceDate(member.joined_at))}</small></div><span class="role-badge">${esc(member.role.replace('_', ' '))}</span></div>`;
  }).join('');
  $('#memberEmpty').innerHTML = state.members.length ? '' : `<div class="inline-empty"><span>♧</span><b>No team members to show</b><p>${state.workspace ? 'Your account is the only member so far.' : state.user ? 'Create a workspace to invite your team.' : 'Sign in to view actual workspace membership.'}</p></div>`;
  $('#inviteMemberButton').disabled = !state.user || !state.workspace || state.role !== 'admin';
  $('#inviteMemberButton').title = state.role !== 'admin' ? 'Only workspace administrators can invite members' : '';
}
function renderHistory() {
  $('#auditTimeline').innerHTML = state.events.map(event => {
    const details = event.details || {};
    const headline = event.event_type.replaceAll('_', ' ');
    const description = details.title || details.name || details.comment || details.description || '';
    return `<div class="audit-item"><i></i><div><b>${esc(headline)}</b>${description ? ` — ${esc(description)}` : ''}<small>${esc(profileName(event.actor_uid))} · ${esc(niceDate(event.created_at))}</small></div></div>`;
  }).join('');
  $('#auditEmpty').innerHTML = state.events.length ? '' : `<div class="inline-empty"><span>◷</span><b>No activity recorded</b><p>${state.workspace ? 'As your team submits reviews, adds sources and records decisions, the events will appear here.' : 'Sign in to view a real audit timeline. Preview activity is not fabricated.'}</p></div>`;
}
function fillSettings() {
  $('#profileUsername').value = state.profile?.username || state.user?.user_metadata?.username || '';
  $('#profileEmail').value = state.user?.email || 'Sign in to edit your profile';
  $('#profileUsername').disabled = !state.user;
  $('#supabaseConnection').textContent = state.user ? 'Authenticated' : configured ? 'Configured · signed out' : 'Not configured';
  $('#supabaseConnection').className = `status-pill ${state.user ? 'success' : 'neutral'}`;
  $('#agentConnection').textContent = state.edgeAvailable ? 'Connected' : state.user ? 'Deploy to enable' : 'Sign in to connect';
  $('#agentConnection').className = `status-pill ${state.edgeAvailable ? 'success' : 'neutral'}`;
}

async function logEvent(eventType, details = {}, reviewId = null) {
  if (!state.db || !state.user || !state.workspace) return;
  const { error } = await state.db.from('review_events').insert({
    workspace_id: state.workspace.id, review_id: reviewId, actor_uid: state.user.id,
    event_type: eventType, details
  });
  if (error) console.warn('Audit event could not be saved:', error.message);
}

// Authentication: a single Supabase identity is used by both Auth and RLS.
$('#googleSignIn').addEventListener('click', async () => {
  if (!state.db) return toast('Add Supabase credentials in config.js first.', 'warning');
  try {
    const { error } = await state.db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) throw error;
  } catch (error) { toast(error.message || 'Google sign-in failed.', 'error'); }
});
$('#toggleAuthMode').addEventListener('click', () => {
  state.authMode = state.authMode === 'signin' ? 'signup' : 'signin';
  $('#authTitle').textContent = state.authMode === 'signup' ? 'Create your BASE account' : 'Welcome to BASE';
  $('#authDescription').textContent = state.authMode === 'signup' ? 'Create a secure account to start a private workspace.' : 'Sign in to access your real workspace and save changes securely.';
  $('#emailAuthSubmit').textContent = state.authMode === 'signup' ? 'Create account' : 'Sign in';
  $('#toggleAuthMode').textContent = state.authMode === 'signup' ? 'I already have an account' : 'Create an account';
});
$('#emailAuthForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.db) return toast('Add Supabase credentials in config.js first.', 'warning');
  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  const button = $('#emailAuthSubmit');
  button.disabled = true; button.textContent = state.authMode === 'signup' ? 'Creating…' : 'Signing in…';
  try {
    if (state.authMode === 'signup') {
      const { data, error } = await state.db.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      if (!data.session) toast('Account created. Check your email to confirm it, then sign in.', 'success');
      else closeModal('authModal');
    } else {
      const { error } = await state.db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeModal('authModal');
    }
  } catch (error) { toast(error.message || 'Authentication failed.', 'error'); }
  finally { button.disabled = false; button.textContent = state.authMode === 'signup' ? 'Create account' : 'Sign in'; }
});
$('#forgotPassword').addEventListener('click', async () => {
  const email = $('#authEmail').value.trim();
  if (!email) return toast('Enter your email address first.', 'warning');
  if (!state.db) return toast('Supabase is not configured.', 'warning');
  const { error } = await state.db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) toast(error.message, 'error'); else toast('Password reset email sent. Check your inbox.', 'success');
});
$('#signOutButton').addEventListener('click', async () => {
  if (!state.db) return;
  const { error } = await state.db.auth.signOut();
  if (error) toast(error.message, 'error'); else toast('Signed out successfully.', 'success');
});
$('#workspaceForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.user || !state.db) return showGuestOrSignIn();
  const name = $('#newWorkspaceName').value.trim();
  if (name.length < 2) return toast('Workspace name must have at least 2 characters.', 'warning');
  const button = $('button[type="submit"]', event.currentTarget); button.disabled = true;
  try {
    const { data, error } = await state.db.rpc('create_workspace', { p_name: name });
    if (error) throw error;
    state.activeWorkspaceId = data;
    try { window.localStorage.setItem(`base-active-workspace:${state.user.id}`, data); } catch {}
    await loadWorkspace(); renderAll(); closeModal('workspaceModal'); event.currentTarget.reset();
    toast(`Workspace “${name}” created. No sample records were added.`, 'success');
  } catch (error) { toast(`Workspace creation failed: ${error.message}`, 'error'); }
  finally { button.disabled = false; }
});

// Review creation is deliberately source-grounded; no local fake checker is used.
$('#startReviewButton').addEventListener('click', () => requireUser() && openModal('reviewModal'));
$('#newReviewButton').addEventListener('click', () => requireUser() && openModal('reviewModal'));
$('#heroReviewButton').addEventListener('click', () => requireUser() && openModal('reviewModal'));
$('#draftTextFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 1024 * 1024) { toast('Text file must be smaller than 1 MB.', 'warning'); event.target.value = ''; return; }
  try {
    const text = await file.text();
    $('#draftContent').value = `${$('#draftContent').value}${$('#draftContent').value ? '\n\n' : ''}${text}`.slice(0, 30000);
  } catch { toast('Could not read that text file.', 'error'); }
});
$('#reviewForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!requireUser()) return;
  const button = $('#submitReviewButton');
  const title = $('#draftTitle').value.trim();
  const content = $('#draftContent').value.trim();
  const channel = $('#draftChannel').value;
  if (!title || !content) return toast('Add a title and draft content.', 'warning');
  button.disabled = true; button.innerHTML = '<span class="spinner"></span> Saving review…';
  let findings = [];
  let analysisNote = 'AI analysis is not configured. The draft was saved without invented findings.';
  if (state.db) {
    try {
      const { data, error } = await invokeAgent37({ mode: 'analyze', workspace_id: state.workspace.id, draft: { title, content, channel } });
      if (!error && data?.findings) {
        findings = data.findings;
        analysisNote = data.note || 'Analysis completed against current workspace sources.';
        state.edgeAvailable = true;
      } else if (error) {
        analysisNote = `AI analysis unavailable: ${error.message || 'Vercel API not deployed or not configured.'}`;
      }
    } catch (error) { analysisNote = `AI analysis unavailable: ${error.message}`; }
  }
  try {
    const { data: review, error } = await state.db.from('reviews').insert({
      workspace_id: state.workspace.id, owner_uid: state.user.id, title, channel,
      content, status: 'Needs review', findings
    }).select().single();
    if (error) throw error;
    await logEvent('review_submitted', { title, channel, findings: findings.length }, review.id);
    await loadWorkspaceData(); renderAll(); closeModal('reviewModal'); event.currentTarget.reset();
    go('reviews');
    toast(findings.length ? `Review saved with ${findings.length} finding(s). ${analysisNote}` : `Review saved. ${analysisNote}`, findings.length ? 'success' : 'info');
    if (review?.id) openReviewDetail(review.id);
  } catch (error) { toast(`Could not save review: ${error.message}`, 'error'); }
  finally { button.disabled = false; button.innerHTML = 'Save & analyse draft <span>→</span>'; }
});

// Brand source management. RLS enforces brand_owner/admin on the server.
$('#addSourceButton').addEventListener('click', () => {
  if (!requireUser()) return;
  if (!currentRoleCanManageSources()) return toast('Only brand owners and workspace administrators can add sources.', 'warning');
  openModal('sourceModal');
});
$('#sourceForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!requireUser()) return;
  if (!currentRoleCanManageSources()) return toast('You do not have permission to manage approved sources.', 'error');
  const button = $('button[type="submit"]', event.currentTarget); button.disabled = true;
  const source = {
    workspace_id: state.workspace.id, name: $('#sourceName').value.trim(),
    source_type: $('#sourceType').value, body: $('#sourceBody').value.trim(),
    owner_id: state.user.id, review_due: $('#sourceDue').value || null
  };
  try {
    const { error } = await state.db.from('brand_sources').insert(source);
    if (error) throw error;
    await logEvent('source_added', { name: source.name, source_type: source.source_type });
    await loadWorkspaceData(); renderAll(); closeModal('sourceModal'); event.currentTarget.reset();
    toast('Approved source saved to your workspace.', 'success');
  } catch (error) { toast(`Could not save source: ${error.message}`, 'error'); }
  finally { button.disabled = false; }
});

// Review detail, comments and human decisions.
async function openReviewDetail(reviewId) {
  const review = state.reviews.find(item => item.id === reviewId);
  if (!review) return;
  state.currentReview = review;
  let comments = [];
  if (!state.demoMode && state.db && state.user && state.workspace) {
    const { data, error } = await state.db.from('review_comments').select('*').eq('review_id', reviewId).order('created_at', { ascending: true });
    if (error) console.warn('Comment load failed:', error.message);
    comments = data || [];
  }
  const findings = Array.isArray(review.findings) ? review.findings : [];
  const canApprove = Boolean(state.user && currentRoleCanReview() && review.owner_uid !== state.user.id);
  const canEdit = Boolean(state.user && (review.owner_uid === state.user.id || ['admin'].includes(state.role)));
  const isGuestDemo = Boolean(state.demoMode);
  $('#detailContent').innerHTML = `
    <span class="eyebrow">REVIEW DETAILS</span><h2 id="detailTitle">${esc(review.title)}</h2>
    <div class="detail-meta"><span>${esc(review.channel || 'Unspecified channel')}</span><span>Submitted by ${esc(profileName(review.owner_uid))}</span><span>${esc(niceDate(review.created_at))}</span></div>
    <div class="detail-status-row"><span class="status-tag ${statusClass(review.status)}">${esc(review.status)}</span><span>${findings.length} finding${findings.length === 1 ? '' : 's'}</span></div>
    <div class="detail-section"><h3>Original draft</h3><pre class="draft-preview">${esc(review.content)}</pre></div>
    <div class="detail-section"><div class="card-heading"><div><h3>Evidence-linked findings</h3><p>Source references are checked against this workspace.</p></div></div>
      ${findings.length ? findings.map((finding, index) => `<article class="finding-card"><div class="finding-header"><span class="severity-dot ${esc(String(finding.severity || 'low').toLowerCase())}"></span><b>${esc(finding.category || 'Review finding')}</b><span class="severity-label">${esc(finding.severity || 'Unrated')}</span></div><p>${esc(finding.finding || finding.explanation || 'No description supplied.')}</p><div class="finding-source">${finding.source_id ? `Evidence: ${esc(finding.source_name || 'Approved source')}` : 'No verified source cited — human verification required'}</div>${finding.suggestion ? `<div class="finding-suggestion"><b>Suggested next step</b><p>${esc(finding.suggestion)}</p><button class="text-button copy-suggestion" data-suggestion="${esc(finding.suggestion)}">Copy suggestion</button></div>` : ''}</article>`).join('') : `<div class="inline-empty"><span>✓</span><b>No structured findings saved</b><p>This does not mean the draft is compliant. Run analysis after Agent 37 is configured and review it against approved sources.</p></div>`}
    </div>
    <div class="detail-section"><h3>Discussion</h3><div class="comment-list">${(comments || []).map(comment => `<div class="comment-item"><b>${esc(profileName(comment.user_id))}</b><small>${esc(niceDate(comment.created_at))}</small><p>${esc(comment.body)}</p></div>`).join('') || '<p class="muted-copy">No comments yet.</p>'}</div>${isGuestDemo ? '<p class="small-note">Guest demo: discussion and decisions are view-only. Sign in to collaborate in your own workspace.</p>' : '<form id="commentForm" class="comment-form"><textarea id="newComment" rows="2" maxlength="4000" placeholder="Add a comment or clarification…" required></textarea><button class="button button-secondary" type="submit">Add comment</button></form>'}</div>
    <div class="detail-actions"><div><small>Approval remains a human decision.</small>${canApprove ? '<p>As a reviewer, you can record a decision for this submission.</p>' : review.owner_uid === state.user?.id ? '<p>You can revise your own draft; another authorised reviewer must approve it.</p>' : '<p>Your role does not include approval permissions.</p>'}</div><div class="action-buttons">${canApprove ? `<select id="reviewDecision"><option value="In progress">In progress</option><option value="Changes requested">Request changes</option><option value="On hold">Put on hold</option><option value="Approved">Approve</option></select><button class="button button-primary" id="saveDecision">Record decision</button>` : ''}${canEdit ? '<button class="button button-danger-outline" id="deleteReviewButton">Delete review</button>' : ''}</div></div>`;
  openModal('detailModal');
  $$('.copy-suggestion').forEach(button => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(button.dataset.suggestion); toast('Suggestion copied. Review and edit it before using.', 'success'); }
    catch { toast('Clipboard access was blocked by the browser.', 'warning'); }
  }));
  $('#commentForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const body = $('#newComment').value.trim(); if (!body) return;
    const { error } = await state.db.from('review_comments').insert({ review_id: review.id, workspace_id: state.workspace.id, user_id: state.user.id, body });
    if (error) return toast(`Could not add comment: ${error.message}`, 'error');
    await logEvent('comment_added', { title: review.title, comment: body.slice(0, 120) }, review.id);
    await openReviewDetail(review.id); await loadWorkspaceData(); renderAll();
    toast('Comment added.', 'success');
  });
  $('#saveDecision')?.addEventListener('click', async () => {
    const nextStatus = $('#reviewDecision').value;
    if (nextStatus === 'Approved' && review.owner_uid === state.user.id) return toast('A creator cannot approve their own review.', 'warning');
    const confirmed = window.confirm(`Record the decision “${nextStatus}” for “${review.title}”?`);
    if (!confirmed) return;
    const { error } = await state.db.rpc('set_review_status', { p_review_id: review.id, p_status: nextStatus });
    if (error) return toast(`Decision could not be saved: ${error.message}`, 'error');
    await loadWorkspaceData(); renderAll(); closeModal('detailModal'); toast(`Decision recorded: ${nextStatus}.`, 'success');
  });
  $('#deleteReviewButton')?.addEventListener('click', async () => {
    if (!window.confirm(`Permanently delete “${review.title}” and its comments? This cannot be undone.`)) return;
    const { error } = await state.db.from('reviews').delete().eq('id', review.id);
    if (error) return toast(`Could not delete review: ${error.message}`, 'error');
    await logEvent('review_deleted', { title: review.title });
    await loadWorkspaceData(); renderAll(); closeModal('detailModal'); toast('Review deleted.', 'success');
  });
}

// Invite a teammate: a user-confirmed action sent by the protected Vercel API.
$('#inviteMemberButton').addEventListener('click', () => {
  if (!requireUser()) return;
  if (state.role !== 'admin') return toast('Only workspace administrators can invite teammates.', 'warning');
  openModal('inviteModal');
});
$('#inviteForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!requireUser() || state.role !== 'admin') return;
  const email = $('#inviteEmail').value.trim(); const role = $('#inviteRole').value;
  const button = $('button[type="submit"]', event.currentTarget); button.disabled = true;
  try {
    const { data, error } = await invokeAgent37({ mode: 'execute', workspace_id: state.workspace.id, confirmed: true, action: { name: 'invite_member', args: { email, role } } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    await logEvent('member_invited', { email, role });
    closeModal('inviteModal'); event.currentTarget.reset();
    toast(data?.message || `Invitation sent to ${email}.`, 'success');
  } catch (error) { toast(`Invitation unavailable: ${error.message}. Check Vercel environment variables and Supabase email delivery.`, 'error'); }
  finally { button.disabled = false; }
});

// Profile settings.
$('#profileForm').addEventListener('submit', async event => {
  event.preventDefault(); if (!state.user || !state.db) return showGuestOrSignIn();
  const username = $('#profileUsername').value.trim();
  if (username.length < 2 || username.length > 32) return toast('Display name must be 2–32 characters.', 'warning');
  try {
    const { error: authError } = await state.db.auth.updateUser({ data: { username } });
    if (authError) throw authError;
    const { data, error } = await state.db.from('profiles').upsert({ user_id: state.user.id, username, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    state.profile = data;
    $('#userName').textContent = username; $('#userAvatar').textContent = initials(username);
    await logEvent('profile_updated', { username }); renderAll();
    toast('Display name updated.', 'success');
  } catch (error) { toast(`Profile update failed: ${error.message}`, 'error'); }
});

// Data export is scoped by RLS and the active workspace.
function downloadFile(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#exportAuditButton').addEventListener('click', () => {
  if (!requireUser()) return;
  const rows = [['timestamp', 'actor', 'event', 'details']];
  state.events.forEach(event => rows.push([event.created_at, profileName(event.actor_uid), event.event_type, JSON.stringify(event.details || {})]));
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  downloadFile(csv, 'base-audit-history.csv', 'text/csv');
});
$('#exportWorkspaceButton').addEventListener('click', () => {
  if (!requireUser()) return;
  const payload = { exported_at: new Date().toISOString(), workspace: state.workspace, reviews: state.reviews, sources: state.sources, members: state.members, events: state.events };
  downloadFile(JSON.stringify(payload, null, 2), 'base-workspace-export.json', 'application/json');
});

// Theme and motion preferences.
function safeGetPreference(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeSetPreference(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* Storage may be blocked; preferences remain usable for this page. */ }
}
function loadPreferences() {
  const savedTheme = safeGetPreference('base-theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.body.classList.add('dark');
  state.reducedMotion = safeGetPreference('base-reduced-motion') === 'true';
  document.body.classList.toggle('reduced-motion', state.reducedMotion);
  syncPreferenceButtons();
}
function syncPreferenceButtons() {
  const dark = document.body.classList.contains('dark');
  $('#darkSwitch').classList.toggle('on', dark); $('#darkSwitch').setAttribute('aria-pressed', String(dark));
  $('#motionSwitch').classList.toggle('on', state.reducedMotion); $('#motionSwitch').setAttribute('aria-pressed', String(state.reducedMotion));
}
function toggleTheme() {
  document.body.classList.toggle('dark');
  safeSetPreference('base-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  syncPreferenceButtons();
  $('#themeButton').textContent = document.body.classList.contains('dark') ? '☀' : '☾';
}
$('#themeButton').addEventListener('click', toggleTheme);
$('#darkSwitch').addEventListener('click', toggleTheme);
$('#motionSwitch').addEventListener('click', () => {
  state.reducedMotion = !state.reducedMotion;
  safeSetPreference('base-reduced-motion', String(state.reducedMotion));
  document.body.classList.toggle('reduced-motion', state.reducedMotion); syncPreferenceButtons();
});

// Agent 37: preview answers are local feature help; authenticated requests go to the secure Vercel API.
function openAgent() {
  $('#agentBackdrop').classList.add('open'); $('#agentDrawer').classList.add('open');
  $('#agentDrawer').setAttribute('aria-hidden', 'false');
  $('#agentContext').textContent = state.user ? `${state.workspace?.name || 'No workspace'} · ${state.role || 'No role'} · Connected account` : 'Guest preview · Conversational help · Sign in for workspace actions';
  $('#agentInput').focus();
}
function closeAgent() {
  $('#agentBackdrop').classList.remove('open'); $('#agentDrawer').classList.remove('open');
  $('#agentDrawer').setAttribute('aria-hidden', 'true');
}
$('#agentTopButton').addEventListener('click', openAgent);
$('#dashboardAgentFeature')?.addEventListener('click', openAgent);
$('#openAgentNav').addEventListener('click', openAgent);
$('#guideAgentButton').addEventListener('click', openAgent);
$('#guideOpenAgent').addEventListener('click', openAgent);
$('#agentFloatingButton').addEventListener('click', openAgent);
$('#guideFastNavAgent').addEventListener('click', openAgent);
$('#guideSafeAgent').addEventListener('click', openAgent);
$('#closeAgent').addEventListener('click', closeAgent);
$('#agentBackdrop').addEventListener('click', closeAgent);
function addAgentMessage(text, who = 'assistant') {
  const container = $('#agentMessages');
  $('.agent-welcome', container)?.remove();
  const node = document.createElement('div'); node.className = `agent-message ${who}`;
  const content = document.createElement('p'); content.textContent = text; node.appendChild(content);
  container.appendChild(node); container.scrollTop = container.scrollHeight;
  return node;
}
function addAgentProposal(proposal) {
  state.pendingAgent = proposal;
  const card = document.createElement('div'); card.className = 'agent-proposal';
  const title = document.createElement('b'); title.textContent = proposal.summary || proposal.name.replaceAll('_', ' ');
  const description = document.createElement('p'); description.textContent = describeAgentAction(proposal);
  const warning = document.createElement('small'); warning.textContent = 'Nothing has changed yet. Review this proposal and confirm before it is applied.';
  const actions = document.createElement('div'); actions.className = 'proposal-actions';
  const cancel = document.createElement('button'); cancel.className = 'button button-secondary'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => { state.pendingAgent = null; card.remove(); addAgentMessage('Cancelled. No change was made.'); });
  const confirm = document.createElement('button'); confirm.className = 'button button-primary'; confirm.textContent = 'Confirm & apply'; confirm.addEventListener('click', () => executeAgentProposal(card, confirm));
  actions.append(cancel, confirm); card.append(title, description, warning, actions);
  $('#agentMessages').appendChild(card); $('#agentMessages').scrollTop = $('#agentMessages').scrollHeight;
}
function describeAgentAction(proposal) {
  const args = proposal.args || {};
  switch (proposal.name) {
    case 'update_username': return `Change your display name to “${args.username}”.`;
    case 'create_review': return `Create a review titled “${args.title}” in ${args.channel || 'the selected channel'}.`;
    case 'create_source': return `Add “${args.name}” as an approved ${args.source_type || 'brand'} source. This will become available as workspace evidence.`;
    case 'update_review_status': return `Change the selected review to “${args.status}”. A reviewer must not approve their own submission.`;
    case 'invite_member': return `Invite ${args.email} to this workspace with the ${args.role} role.`;
    case 'delete_review': return `Permanently delete review ${args.review_id}. Its attached comments will also be removed.`;
    case 'add_review_comment': return `Post this comment on review ${args.review_id}: “${args.comment}”.`;
    case 'update_workspace_name': return `Rename this workspace to “${args.name}”.`;
    default: return 'Apply the proposed change to your active workspace.';
  }
}
async function executeAgentProposal(card, button) {
  if (!state.pendingAgent || !state.db) return;
  button.disabled = true; button.textContent = 'Applying…';
  const proposal = state.pendingAgent;
  try {
    const { data, error } = await invokeAgent37({ mode: 'execute', confirmed: true, workspace_id: state.workspace?.id || null, action: proposal });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    state.pendingAgent = null; card.remove();
    addAgentMessage(data?.message || 'The requested action was completed.');
    if (data?.navigate) go(data.navigate);
    await ensureProfile();
    $('#userName').textContent = getDisplayName(); $('#userAvatar').textContent = initials(getDisplayName());
    await loadWorkspaceData(); renderAll();
  } catch (error) {
    button.disabled = false; button.textContent = 'Retry confirmation';
    addAgentMessage(`I could not apply that action: ${error.message}. No success has been assumed; check your permissions and try again.`);
  }
}
function guestAgentReply(message) {
  const lower = message.toLowerCase().trim().replace(/[!?.,]+$/g, '');
  const greetings = /^(hi|hello|hey|hii+|good morning|good afternoon|good evening|howdy|yo|namaste|नमस्ते)(\s+there)?$/i;
  if (greetings.test(lower)) return 'Hey! 👋 I’m Agent 37, the BASE assistant. I can help you understand the platform, explain how reviews and approved sources work, show you around the feature guide, and help you get started. What are you working on today?';
  if (/^(how are you|how are u|what's up|whats up)$/.test(lower)) return 'Doing well and ready to help! I can walk you through BASE, explain a feature step by step, or help you decide where to start. What would you like to explore?';
  if (/^(thanks|thank you|thx|ty)$/.test(lower)) return 'You’re welcome! If you want, tell me what you’re trying to do in BASE and I’ll guide you through it.';
  if (/^(help|what can you do|what do you do|capabilities)$/.test(lower)) return 'I can help with:\n• Explaining every BASE area and its workflow\n• Showing you the review queue, source library, insights, team and audit history\n• Guiding you through sign-in and workspace setup\n• Navigating to a page in this preview\n• Explaining which actions require a role or confirmation\n\nSign in to connect me to your real workspace. I’ll always ask before changing saved data.';
  if (/^(who are you|what is your name)$/.test(lower)) return 'I’m Agent 37, the built-in BASE assistant for Brand Assurance & Source Evidence. I help people understand the product and, when signed in, work with supported workspace features under your permissions.';
  if (/^(what is base|what is this|explain base|about base)$/.test(lower)) return 'BASE means Brand Assurance & Source Evidence. It brings together a source library for approved brand knowledge, a review queue for checking content against that knowledge, insights from real review findings, team roles and an audit timeline. Agent 37 helps you navigate and prepare supported actions. Guest demo is read-only and uses clearly labelled illustrative sample records.';
  const routes = [
    ['overview', ['overview', 'dashboard', 'home']], ['reviews', ['review queue', 'reviews', 'review page']],
    ['sources', ['source library', 'brand sources', 'sources']], ['insights', ['insights', 'analytics']],
    ['team', ['team', 'members', 'roles']], ['history', ['audit', 'history']],
    ['settings', ['settings', 'username', 'profile']], ['guide', ['feature guide', 'features', 'how does base work']]
  ];
  const target = routes.find(([, terms]) => terms.some(term => lower.includes(term)));
  if (target && /go to|open|show|take me|navigate|visit/.test(lower)) {
    go(target[0]); return `Opened ${target[0]}. This is the guest demo, so you are seeing illustrative sample records; changes require a signed-in workspace.`;
  }
  if (lower.includes('username') || lower.includes('display name')) return 'To change your display name, sign in, open Settings, edit “Your profile” and save. You can also ask me to change it after Agent 37 is connected to your authenticated workspace. I will ask you to confirm before applying it.';
  if (lower.includes('google') || lower.includes('login') || lower.includes('sign in')) return 'Use the Sign in button to continue with Google or email and password. Google OAuth must be enabled in your Supabase project and its redirect URL must include this site domain.';
  if (lower.includes('agent 37') || /\bai\b/.test(lower)) return 'Agent 37 is designed to answer workspace questions, navigate pages and prepare supported actions such as changing your display name, creating reviews or sources, inviting a teammate and updating review status. It needs the secure Vercel API endpoint connected to your Agent 37 Cloud instance. Every data-changing action is presented for confirmation.';
  const section = routes.find(([, terms]) => terms.some(term => lower.includes(term)));
  if (section) return featureHelp[section[0]];
  return 'I can help you explore BASE in the guest demo. The dashboard contains illustrative sample records, not private account data. Sign in to connect your own workspace and save changes. Try asking about reviews, approved sources, insights, team roles, audit history or Agent 37—or tell me which page you want to open.';
}
async function sendAgentMessage() {
  const input = $('#agentInput'); const message = input.value.trim();
  if (!message) return;
  input.value = ''; input.style.height = 'auto';
  addAgentMessage(message, 'user');
  if (!state.user) { addAgentMessage(guestAgentReply(message)); return; }
  const waiting = addAgentMessage('Thinking through your request…'); waiting.classList.add('thinking');
  $('#agentSend').disabled = true;
  try {
    const { data, error } = await invokeAgent37({ mode: 'chat', workspace_id: state.workspace?.id || null, message });
    waiting.remove();
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    state.edgeAvailable = true; fillSettings();
    addAgentMessage(data?.reply || 'I could not form a response. Please try again.');
    if (data?.proposal) addAgentProposal(data.proposal);
    if (data?.navigate) go(data.navigate);
  } catch (error) {
    waiting.remove();
    const detail = error?.message || error?.context?.message || 'Unknown connection error';
    const hint = /401|unauthori[sz]ed|jwt|token/i.test(detail) ? 'Your sign-in session may have expired. Sign out and sign in again.' : /404|not found|function/i.test(detail) ? 'Check that the Vercel deployment includes api/agent-37.ts.' : /AGENT37_API_KEY|AGENT37_INSTANCE_ID|api key|instance|unauthori[sz]ed|temporarily unavailable/i.test(detail) ? 'Check AGENT37_API_KEY and AGENT37_INSTANCE_ID in Vercel Project Settings → Environment Variables.' : 'Check the Vercel deployment logs and your network connection.';
    addAgentMessage(`I couldn’t reach the Agent 37 service.

Details: ${detail}

Next step: ${hint} Your data has not been changed.`);
  } finally { $('#agentSend').disabled = false; }
}
$('#agentSend').addEventListener('click', sendAgentMessage);
$('#agentInput').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendAgentMessage(); }
});
$('#agentInput').addEventListener('input', event => { event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`; });
$$('[data-prompt]').forEach(button => button.addEventListener('click', () => { $('#agentInput').value = button.dataset.prompt; sendAgentMessage(); }));

// Search, modal dismissal, keyboard shortcuts, and page controls.
$('#reviewSearch').addEventListener('input', renderReviews);
$('#reviewStatusFilter').addEventListener('change', renderReviews);
$('#reviewPriorityFilter').addEventListener('change', renderReviews);
$('#sourceSearch').addEventListener('input', renderSources);
$$('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));
$$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop.id); }));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeAgent(); $$('.modal-backdrop.open').forEach(modal => closeModal(modal.id)); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openAgent(); }
});
$('#inviteMemberButton').disabled = true;
$('#supabaseConnection').textContent = configured ? 'Configured · checking session' : 'Not configured';

function bindStaticControls() {
  // Product guide and navigation are available in the no-login preview.
  // Mark actions as unavailable when signed out; handlers still re-check auth at submit time.
  $$('.require-auth').forEach(button => button.addEventListener('click', event => {
    if (!state.user) { event.preventDefault(); event.stopImmediatePropagation(); showGuestOrSignIn('Sign in to save and manage real workspace data. Guest preview is read-only.'); }
  }, true));
}

initialise();


// ---------- Landing buttons ----------
function openAuth(mode) {
  if (state.authMode !== mode) $('#toggleAuthMode').click();
  openModal('authModal');
}
$('#landingLogin')?.addEventListener('click', () => openAuth('signin'));
$('#landingSignup')?.addEventListener('click', () => openAuth('signup'));

// Public landing actions: authentication and guest demo are separate entry paths.
function syncPublicThemeButtons() {
  const dark = document.body.classList.contains('dark');
  $$('[data-theme-choice]').forEach(button => {
    const selected = button.dataset.themeChoice === (dark ? 'dark' : 'light');
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
$$('#publicLogin, #publicHeroLogin, #publicFooterLogin').forEach(button => button.addEventListener('click', () => openAuth('signin')));
$$('#publicSignup, #publicHeroSignup, #publicFinalSignup').forEach(button => button.addEventListener('click', () => openAuth('signup')));
$('#publicGoogle')?.addEventListener('click', () => $('#googleSignIn').click());
$('#publicGuest')?.addEventListener('click', () => enterGuestDemo('overview'));
$('#publicWorkflowGuest')?.addEventListener('click', () => enterGuestDemo('reviews'));
$('#publicFinalGuest')?.addEventListener('click', () => enterGuestDemo('overview'));
$$('[data-enter-demo]').forEach(button => button.addEventListener('click', () => enterGuestDemo(button.dataset.demoView || 'overview')));
$$('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
  const wantsDark = button.dataset.themeChoice === 'dark';
  if (document.body.classList.contains('dark') !== wantsDark) toggleTheme();
  syncPublicThemeButtons();
}));
syncPublicThemeButtons();

// A short, navigable tour of the public landing page.
const PUBLIC_TOUR = [
  { target: '#publicHome', title: 'Welcome to BASE', text: 'BASE connects content reviews to approved facts and brand rules. It explains risks and keeps people responsible for the final decision.' },
  { target: '#publicFeatures', title: 'Explore the platform', text: 'Open each feature card to read what it does, when to use it, and what safeguards apply. You can jump directly into a guest example from the cards.' },
  { target: '#publicWorkflow', title: 'Understand the workflow', text: 'Start with trusted sources, submit a draft, inspect evidence-linked findings, and record a human decision.' },
  { target: '#publicTrust', title: 'Trust and control', text: 'AI findings are recommendations, not automatic approvals. Guest exploration uses clearly labelled sample data and does not write to your workspace.' }
];
let publicTourIndex = -1, publicTourNode = null;
function finishPublicTour() {
  publicTourNode?.remove(); publicTourNode = null;
  $$('.public-tour-highlight').forEach(node => node.classList.remove('public-tour-highlight'));
  publicTourIndex = -1;
}
function showPublicTour(index) {
  if (index < 0 || index >= PUBLIC_TOUR.length) return finishPublicTour();
  publicTourIndex = index;
  const step = PUBLIC_TOUR[index];
  $$('.public-tour-highlight').forEach(node => node.classList.remove('public-tour-highlight'));
  const target = document.querySelector(step.target);
  target?.classList.add('public-tour-highlight');
  target?.scrollIntoView({ behavior: state.reducedMotion ? 'auto' : 'smooth', block: 'center' });
  if (!publicTourNode) {
    publicTourNode = document.createElement('aside');
    publicTourNode.className = 'public-tour-card';
    publicTourNode.setAttribute('role', 'dialog');
    publicTourNode.setAttribute('aria-label', 'Landing page guide tour');
    document.body.appendChild(publicTourNode);
  }
  publicTourNode.innerHTML = `<small>WEBSITE GUIDE · ${index + 1} / ${PUBLIC_TOUR.length}</small><button class="public-tour-close" aria-label="Close tour">×</button><h3>${step.title}</h3><p>${step.text}</p><div class="public-tour-controls"><button data-public-tour="back" ${index === 0 ? 'disabled' : ''}>Back</button><span></span><button data-public-tour="next">${index === PUBLIC_TOUR.length - 1 ? 'Finish tour' : 'Next step'}</button></div>`;
  $('.public-tour-close', publicTourNode).addEventListener('click', finishPublicTour);
  $('[data-public-tour=back]', publicTourNode).addEventListener('click', () => showPublicTour(index - 1));
  $('[data-public-tour=next]', publicTourNode).addEventListener('click', () => showPublicTour(index + 1));
}
$('#publicGuideTour')?.addEventListener('click', () => showPublicTour(0));
document.addEventListener('keydown', event => { if (event.key === 'Escape') finishPublicTour(); });
$('#publicMenu')?.addEventListener('click', () => $('#publicFeatures')?.scrollIntoView({ behavior: 'smooth' }));

$('#themeButton').textContent = document.body.classList.contains('dark') ? '☀' : '☾';

// ---------- Detailed explanation under every page heading ----------
const EXPLAIN = {
  overview: ['What this dashboard does', 'The overview summarises your active workspace: totals for reviews, open items, approved sources and team members come live from your database. Use “New review” to submit content, or the source library link to add the approved facts BASE compares drafts against.'],
  reviews: ['How the review queue works', 'Each row is a draft submitted for checking. Open one to read Agent 37’s findings (severity, explanation, source reference and suggestion), add comments, and change status. To keep separation of duties, the person who submitted a review cannot be the one who approves it.'],
  sources: ['Why brand sources matter', 'Sources are your single source of truth: approved messaging, claims, legal wording and style rules. Analysis only cites sources that are approved, so every finding can be traced to a document your team trusts. Add, search and approve sources here (approval needs the right role).'],
  insights: ['Reading your insights', 'Insights aggregate findings across reviews so you can see which issues repeat, how severe they are and how quickly reviews are resolved. Use them to decide which brand rules need clearer wording.'],
  team: ['Roles and permissions', 'Admins can invite members and rename the workspace. Reviewers can approve sources and decide reviews; members can submit content and comment. Permissions are enforced by the database, not just by the interface.'],
  history: ['Audit history', 'Every status change, approval, invitation and comment is recorded as an event with who did it and when. This timeline is append-only so decisions stay accountable.'],
  settings: ['Settings explained', 'Change your display name, switch between light and dark mode, reduce motion, review connected services and download a copy of your data. Appearance choices are saved on this device only.'],
  guide: ['Using this guide', 'Each card summarises one feature. Press “Guide tour” in the top bar for a step-by-step walkthrough that jumps to each part of the website.']
};
const ILL = {"overview": "<svg viewBox=\"0 0 120 100\" aria-hidden=\"true\"><path d=\"M60 6l40 14v28c0 24-16 40-40 48-24-8-40-24-40-48V20z\" fill=\"#34495E\"/><circle cx=\"60\" cy=\"44\" r=\"14\" fill=\"#BDC3C7\"/></svg>", "reviews": "<svg viewBox=\"0 0 120 100\" aria-hidden=\"true\"><rect x=\"28\" y=\"8\" width=\"64\" height=\"84\" rx=\"8\" fill=\"#ECF0F1\" stroke=\"#BDC3C7\" stroke-width=\"2\"/><rect x=\"38\" y=\"22\" width=\"40\" height=\"6\" rx=\"3\" fill=\"#34495E\"/><rect x=\"38\" y=\"36\" width=\"44\" height=\"5\" rx=\"2.5\" fill=\"#BDC3C7\"/><rect x=\"38\" y=\"48\" width=\"34\" height=\"5\" rx=\"2.5\" fill=\"#BDC3C7\"/><circle cx=\"82\" cy=\"72\" r=\"16\" fill=\"#7F8C8D\"/><path d=\"M74 72l6 6 10-12\" stroke=\"#fff\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"/></svg>", "sources": "<svg viewBox=\"0 0 120 100\" aria-hidden=\"true\"><rect x=\"14\" y=\"58\" width=\"92\" height=\"22\" rx=\"5\" fill=\"#34495E\"/><rect x=\"22\" y=\"34\" width=\"80\" height=\"22\" rx=\"5\" fill=\"#7F8C8D\"/><rect x=\"30\" y=\"10\" width=\"68\" height=\"22\" rx=\"5\" fill=\"#BDC3C7\"/></svg>", "insights": "<svg viewBox=\"0 0 120 100\" aria-hidden=\"true\"><rect x=\"14\" y=\"56\" width=\"18\" height=\"34\" rx=\"3\" fill=\"#BDC3C7\"/><rect x=\"41\" y=\"36\" width=\"18\" height=\"54\" rx=\"3\" fill=\"#7F8C8D\"/><rect x=\"68\" y=\"20\" width=\"18\" height=\"70\" rx=\"3\" fill=\"#34495E\"/><path d=\"M14 40l30-14 26-10 30-8\" stroke=\"#34495E\" stroke-width=\"3\" fill=\"none\"/></svg>", "team": "<svg viewBox=\"0 0 120 100\" aria-hidden=\"true\"><circle cx=\"60\" cy=\"30\" r=\"14\" fill=\"#34495E\"/><path d=\"M34 80c0-18 12-28 26-28s26 10 26 28z\" fill=\"#34495E\"/><circle cx=\"26\" cy=\"42\" r=\"10\" fill=\"#7F8C8D\"/><circle cx=\"94\" cy=\"42\" r=\"10\" fill=\"#7F8C8D\"/></svg>", "history": "<svg viewBox=\"0 0 120 100\" aria-hidden=\"true\"><rect x=\"56\" y=\"8\" width=\"8\" height=\"84\" rx=\"4\" fill=\"#BDC3C7\"/><circle cx=\"60\" cy=\"22\" r=\"9\" fill=\"#34495E\"/><circle cx=\"60\" cy=\"50\" r=\"9\" fill=\"#7F8C8D\"/><circle cx=\"60\" cy=\"78\" r=\"9\" fill=\"#34495E\"/><rect x=\"74\" y=\"16\" width=\"32\" height=\"12\" rx=\"4\" fill=\"#BDC3C7\"/><rect x=\"14\" y=\"44\" width=\"32\" height=\"12\" rx=\"4\" fill=\"#BDC3C7\"/><rect x=\"74\" y=\"72\" width=\"32\" height=\"12\" rx=\"4\" fill=\"#BDC3C7\"/></svg>", "settings": "<svg viewBox=\"0 0 120 100\" aria-hidden=\"true\"><rect x=\"14\" y=\"22\" width=\"92\" height=\"8\" rx=\"4\" fill=\"#BDC3C7\"/><circle cx=\"76\" cy=\"26\" r=\"11\" fill=\"#34495E\"/><rect x=\"14\" y=\"52\" width=\"92\" height=\"8\" rx=\"4\" fill=\"#BDC3C7\"/><circle cx=\"38\" cy=\"56\" r=\"11\" fill=\"#7F8C8D\"/><rect x=\"14\" y=\"82\" width=\"92\" height=\"8\" rx=\"4\" fill=\"#BDC3C7\"/><circle cx=\"64\" cy=\"86\" r=\"11\" fill=\"#34495E\"/></svg>", "guide": "<svg viewBox=\"0 0 120 100\" aria-hidden=\"true\"><circle cx=\"60\" cy=\"50\" r=\"38\" fill=\"#BDC3C7\"/><circle cx=\"60\" cy=\"50\" r=\"30\" fill=\"#ECF0F1\"/><path d=\"M60 24l10 30-10 22-10-22z\" fill=\"#34495E\"/><circle cx=\"60\" cy=\"50\" r=\"5\" fill=\"#7F8C8D\"/></svg>"};
Object.entries(EXPLAIN).forEach(([view, [title, body]]) => {
  const section = document.getElementById(view);
  if (!section || section.querySelector('.explain-ready')) return;
  const existing = section.querySelector('.feature-explain');
  const art = `<span class="ill" aria-hidden="true">${ILL[view] || ''}</span>`;
  if (existing) {
    const inner = existing.querySelector(':scope > div');
    if (inner) inner.innerHTML = `<div class="txt">${inner.innerHTML}<p class="more"><b>In short:</b> ${body}</p></div>${art}`;
    existing.classList.add('explain-ready');
    return;
  }
  const heading = section.querySelector('.page-heading');
  if (!heading) return;
  const d = document.createElement('details');
  d.className = 'feature-explain explain-ready';
  d.innerHTML = `<summary>ⓘ ${title} <span>+</span></summary><div><div class="txt">${body}</div>${art}</div>`;
  heading.after(d);
});

// ---------- Guided website tour ----------
const TOUR = [
  { view: 'overview', sel: '#landing:not([hidden]), .heading-home', title: 'Welcome to BASE', text: 'BASE verifies content against your approved brand documents and keeps every decision accountable. This tour visits each part of the site and explains what it does.' },
  { view: 'overview', sel: '#sidebar', title: 'Navigation', text: 'The sidebar switches between the review queue, brand sources, insights, team, audit history and settings. The workspace switcher at the top lets you move between workspaces.' },
  { view: 'overview', sel: '.hero-panel', title: 'Control center', text: 'Start a review or set up your source library from here. The four cards below show live totals from your workspace.' },
  { view: 'sources', sel: '#sources .page-heading', title: 'Brand sources', text: 'Add approved facts, claims and style rules. Agent 37 compares drafts only against approved sources and cites them in every finding.' },
  { view: 'reviews', sel: '#reviews .page-heading', title: 'Review queue', text: 'Submit drafts, search and filter them, open one to see findings, comment, and approve or reject. Submitters cannot approve their own work.' },
  { view: 'insights', sel: '#insights .page-heading', title: 'Insights', text: 'See recurring issues, severity and turnaround so you can improve your brand rules.' },
  { view: 'team', sel: '#team .page-heading', title: 'Team & roles', text: 'Invite colleagues (admins only) and see who can submit, review or administer.' },
  { view: 'history', sel: '#history .page-heading', title: 'Audit history', text: 'A permanent timeline of who changed what and when.' },
  { view: 'settings', sel: '#settings .page-heading', title: 'Settings & theme', text: 'Edit your profile, switch light/dark mode, reduce motion and export your data.' },
  { view: 'overview', sel: '#agentTopButton', title: 'Agent 37', text: 'Your AI assistant. Ask it to explain features, navigate, create reviews or add sources. It always asks you to confirm before changing data.' }
];
let tourIndex = -1, tourBox = null;
function endTour() { tourBox?.remove(); tourBox = null; tourIndex = -1; $$('.tour-highlight').forEach(e => e.classList.remove('tour-highlight')); go('overview'); }
function showTour(i) {
  if (i < 0 || i >= TOUR.length) return endTour();
  tourIndex = i; const s = TOUR[i];
  go(s.view);
  $$('.tour-highlight').forEach(e => e.classList.remove('tour-highlight'));
  const target = s.sel.split(',').map(x => document.querySelector(x.trim())).find(el => el && el.offsetParent !== null);
  if (target) { target.classList.add('tour-highlight'); target.scrollIntoView({ block: 'center', behavior: state.reducedMotion ? 'auto' : 'smooth' }); }
  if (!tourBox) { tourBox = document.createElement('div'); tourBox.className = 'tour-box'; tourBox.setAttribute('role', 'dialog'); tourBox.setAttribute('aria-label', 'Website guide tour'); document.body.appendChild(tourBox); }
  tourBox.innerHTML = `<small>Step ${i + 1} of ${TOUR.length}</small><h3>${s.title}</h3><p>${s.text}</p><div class="tour-actions"><button class="button button-secondary button-small" data-t="skip">Skip</button><span></span>${i ? '<button class="button button-secondary button-small" data-t="back">Back</button>' : ''}<button class="button button-primary button-small" data-t="next">${i === TOUR.length - 1 ? 'Finish' : 'Next'}</button></div>`;
  tourBox.querySelector('[data-t=next]').onclick = () => showTour(i + 1);
  tourBox.querySelector('[data-t=back]')?.addEventListener('click', () => showTour(i - 1));
  tourBox.querySelector('[data-t=skip]').onclick = endTour;
}
$$('[data-tour]').forEach(b => b.addEventListener('click', () => showTour(0)));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && tourBox) endTour(); });
