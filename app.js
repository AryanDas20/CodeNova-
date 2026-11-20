import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { supabaseConfig } from './config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = {
  db: null, session: null, user: null, view: 'overview', authMode: 'signin',
  filter: 'All', sort: 'featured', history: [], historyFilter: 'all',
  plans: [], currentPlan: null, searchesThisSession: 0, sharesThisSession: 0,
  shareData: null, shareCanvas: null, tourIndex: -1, tourHighlight: null,
  historyReady: false, historyError: '',
};

const destinations = [
  {id:'bali',name:'Bali',country:'Indonesia',region:'Southeast Asia',mood:'Coast',days:5,tagline:'Island days, temple mornings, and a slower rhythm.',description:'A layered island escape with surf towns, quiet rice terraces, dramatic temples, and long golden evenings. It works beautifully when you balance the well-loved places with time to wander.',highlights:['Ubud rice terraces','Uluwatu cliffs','Local food markets'],bestFor:['Coast','Nature','Food','Slow travel'],image:'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=950&q=82'},
  {id:'kyoto',name:'Kyoto',country:'Japan',region:'East Asia',mood:'Culture',days:4,tagline:'Old lanes, quiet gardens, and thoughtful details.',description:'A city where tradition and everyday life sit side by side. Explore temple paths early, pause in small tea houses, and let neighbourhood streets set the pace between bigger sights.',highlights:['Higashiyama lanes','Fushimi Inari paths','Nishiki Market'],bestFor:['Culture','Food','Slow travel'],image:'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=950&q=82'},
  {id:'kerala',name:'Kerala',country:'India',region:'South Asia',mood:'Nature',days:6,tagline:'Backwater mornings and green horizons.',description:'A gentle mix of backwaters, spice-scented hills, beaches, and lively local food. Kerala is best enjoyed with enough time to move between landscapes without rushing.',highlights:['Alleppey backwaters','Munnar tea gardens','Fort Kochi streets'],bestFor:['Nature','Food','Coast','Slow travel'],image:'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=950&q=82'},
  {id:'lisbon',name:'Lisbon',country:'Portugal',region:'Southern Europe',mood:'Food',days:4,tagline:'Tile-lined streets, sea light, and late dinners.',description:'A warm, walkable city of hills, viewpoints, neighbourhood cafés, music, and easy day trips. Give yourself room for unplanned stops and a long meal.',highlights:['Alfama lanes','Belém waterfront','Time Out Market area'],bestFor:['Culture','Food','Slow travel'],image:'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=950&q=82'},
  {id:'swiss-alps',name:'Swiss Alps',country:'Switzerland',region:'Central Europe',mood:'Nature',days:6,tagline:'Mountain air, lake paths, and open views.',description:'A nature-first escape built around scenic rail journeys, valley walks, mountain viewpoints, and small villages. Choose a base thoughtfully and leave room for the weather.',highlights:['Lauterbrunnen valley','Lake Brienz','Mountain railways'],bestFor:['Nature','Adventure','Slow travel'],image:'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=950&q=82'},
  {id:'cappadocia',name:'Cappadocia',country:'Türkiye',region:'West Asia',mood:'Adventure',days:3,tagline:'A landscape that looks like another planet.',description:'A striking region of rock formations, cave architecture, valleys, and wide-open skies. Sunrise is special here, but the quieter valley walks deserve time too.',highlights:['Göreme valleys','Open-air museum','Sunrise viewpoints'],bestFor:['Adventure','Nature','Culture'],image:'https://images.unsplash.com/photo-1570939274717-7eda259b50ed?auto=format&fit=crop&w=950&q=82'},
  {id:'edinburgh',name:'Edinburgh',country:'Scotland',region:'Northern Europe',mood:'Culture',days:3,tagline:'Layered history and small streets with stories.',description:'A compact city for walking, independent bookshops, dramatic architecture, museums, and cosy cafés. The best route often follows the city’s smaller closes and viewpoints.',highlights:['Old Town closes','Calton Hill','Dean Village'],bestFor:['Culture','Food','Slow travel'],image:'https://images.unsplash.com/photo-1506377585622-bedcbb027afc?auto=format&fit=crop&w=950&q=82'},
  {id:'jaipur',name:'Jaipur',country:'India',region:'South Asia',mood:'Culture',days:3,tagline:'Pink facades, craft traditions, and vivid flavours.',description:'A colourful introduction to Rajasthan through forts, courtyards, textile workshops, markets, and local food. Plan the outdoor sights for cooler parts of the day.',highlights:['Amber Fort','Hawa Mahal area','Craft and textile bazaars'],bestFor:['Culture','Food','Shopping'],image:'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=950&q=82'},
  {id:'santorini',name:'Santorini',country:'Greece',region:'Mediterranean',mood:'Coast',days:4,tagline:'Caldera views and a little time by the water.',description:'A dramatic island landscape with cliffside villages, coastal paths, small wineries, and memorable sunsets. Staying slightly beyond the busiest centre can create a calmer trip.',highlights:['Oia viewpoints','Fira to Imerovigli walk','Black-sand beaches'],bestFor:['Coast','Food','Slow travel'],image:'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=950&q=82'}
];

const tourSteps = [
  {view:'overview',selector:'.overview-hero',title:'Your travel desk',text:'This is your home base. Start a new itinerary, explore curated travel moods, see suggested destinations, and pick up recent activity. The overview changes as you search and plan.'},
  {view:'discover',selector:'#destinationFilters',title:'Discover places',text:'Search by destination, country, region, or travel mood. Use these filters to focus on coast, culture, nature, food, or slow travel. Open a destination card to read its snapshot and send it to the planner.'},
  {view:'planner',selector:'#plannerForm',title:'Build a journey',text:'Choose where and when you want to go, add your travel group, budget, and interests, then create a structured itinerary. The result includes day sections, budget guidance, and packing ideas. Verify current local details before booking.'},
  {view:'history',selector:'#historyList',title:'Return to your ideas',text:'Signed-in travellers can revisit searches and plans saved to their private account. Guest mode still supports the full planner, but intentionally does not create permanent personal history.'},
  {view:'share',selector:'#sharePreview',title:'Share the feeling',text:'Use a plan or custom details to make a picture card. Download the PNG, share it with compatible apps, or copy a link that opens a preview of the itinerary. Only put public-friendly details into a share card.'},
  {view:'settings',selector:'.theme-choices',title:'Make Wayfarer yours',text:'Switch between the soft Evening and Daylight palettes. Here you can also see your account state and sign out. Signing out takes you back to the public landing page.'}
];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function safeDate(date) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
}
function formatDate(value, options = {day:'numeric',month:'short',year:'numeric'}) {
  if (!value) return 'Dates flexible';
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat(undefined, options).format(d);
}
function formatRange(start, end) {
  if (!start && !end) return 'Dates flexible';
  if (start && end) return `${formatDate(start,{day:'numeric',month:'short'})} – ${formatDate(end,{day:'numeric',month:'short',year:'numeric'})}`;
  return formatDate(start || end);
}
function niceTime(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date);
}
function toast(message, kind = 'info') {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.dataset.kind = kind;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 3600);
}
function supabaseConfigured() {
  const url = String(supabaseConfig?.url || '').trim();
  const key = String(supabaseConfig?.anonKey || '').trim();
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.length > 20 && !/YOUR_|PASTE_/i.test(key) && !key.startsWith('sb_secret_');
}

function applyTheme(theme, persist = true) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  $$('.theme-glyph').forEach(node => node.textContent = next === 'dark' ? '◐' : '☼');
  $$('[data-theme-choice]').forEach(button => button.classList.toggle('active', button.dataset.themeChoice === next));
  if (persist) {
    try { localStorage.setItem('wayfarer-theme', next); } catch {}
  }
}
function toggleTheme() { applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); }

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
  const focus = $('input,button,select,textarea', modal);
  setTimeout(() => focus?.focus(), 60);
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  if (!$('.modal-backdrop.open')) document.body.classList.remove('modal-open');
}
function openAuth(mode = 'signin') {
  state.authMode = mode;
  renderAuthMode();
  openModal('authModal');
}
function renderAuthMode() {
  const signup = state.authMode === 'signup';
  $('#authTitle').textContent = signup ? 'Start your next story.' : 'Welcome back.';
  $('#authDescription').textContent = signup ? 'Create an account to keep every search and itinerary in your private history.' : 'Sign in to save your searches and trip plans across sessions.';
  $('#emailAuthSubmit').innerHTML = signup ? 'Create account <span>↗</span>' : 'Log in <span>↗</span>';
  $('#authSwitchText').textContent = signup ? 'Already have an account?' : 'New to Wayfarer?';
  $('#toggleAuthMode').textContent = signup ? 'Log in instead' : 'Create an account';
  $('#authPassword').autocomplete = signup ? 'new-password' : 'current-password';
  $('#authMessage').textContent = supabaseConfigured() ? 'Your account is secured by the connected Supabase project.' : 'Authentication is not configured yet. Add your Supabase URL and publishable key in config.js.';
}

function enterApp({session = state.session, guest = false, view = 'overview'} = {}) {
  if (session?.user) {
    state.session = session;
    state.user = session.user;
  } else if (guest) {
    state.session = null;
    state.user = null;
  }
  $('#siteHeader').hidden = true;
  $('#landingPage').hidden = true;
  $('#appShell').hidden = false;
  document.body.classList.add('in-app');
  updateAccountUI();
  switchView(view);
  renderOverviewStats();
  renderRecentActivity();
  renderHistory();
  if (state.user) loadHistory();
}
function showLanding() {
  endTour(false);
  $('#siteHeader').hidden = false;
  $('#landingPage').hidden = false;
  $('#appShell').hidden = true;
  document.body.classList.remove('in-app');
  closeModal('authModal');
  window.scrollTo({top:0,behavior:'smooth'});
}
function displayName() {
  const meta = state.user?.user_metadata || {};
  return meta.full_name || meta.name || meta.username || state.user?.email?.split('@')[0] || 'Traveller';
}
function initials(name = '') {
  return String(name).split(/[\s.@_-]+/).filter(Boolean).slice(0,2).map(part => part[0].toUpperCase()).join('') || 'W';
}
function updateAccountUI() {
  const signedIn = Boolean(state.user);
  const name = signedIn ? displayName() : 'Guest traveller';
  const email = signedIn ? state.user.email || 'Signed-in account' : 'Guest session';
  $('#profileAvatar').textContent = initials(name);
  $('#profileName').textContent = name;
  $('#profileStatus').textContent = signedIn ? 'Personal history enabled' : 'Guest mode · not saved';
  $('#modePill').innerHTML = `<i></i> ${signedIn ? 'Personal workspace' : 'Guest workspace'}`;
  $('#modePill').classList.toggle('is-signed-in', signedIn);
  $('#topAccountButton').textContent = signedIn ? 'Account' : 'Sign in';
  $('#settingsAccountTitle').textContent = name;
  $('#settingsAccountText').textContent = signedIn ? 'Your travel searches and generated plans can be saved to your account history.' : 'You are exploring without an account. You can still use discovery, planning and travel cards.';
  $('#settingsAvatar').textContent = initials(name);
  $('#settingsEmail').textContent = email;
  $('#settingsAccountState').textContent = signedIn ? 'Personal history enabled' : 'History is not saved';
  $('#settingsAccountAction').hidden = signedIn;
  $('#signOutButton').hidden = !signedIn;
  $('#welcomeHeading').textContent = signedIn ? `Welcome back, ${name.split(' ')[0]}.` : 'A new adventure starts here.';
}

function switchView(view) {
  const allowed = ['overview','discover','planner','history','share','guide','settings'];
  if (!allowed.includes(view)) view = 'overview';
  state.view = view;
  $$('.dashboard-view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
  $$('.side-link[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('#currentPageName').textContent = ({overview:'Overview',discover:'Discover places',planner:'Trip planner',history:'Travel history',share:'Share a trip',guide:'Feature guide',settings:'Preferences'})[view];
  $('#appSidebar').classList.remove('open');
  if (view === 'history') renderHistory();
  if (view === 'share') refreshSharePlanSelect();
  if (view === 'settings') applyTheme(document.documentElement.dataset.theme, false);
}

async function persistActivity(type, title, destination, payload = {}) {
  if (!state.user || !state.db) return null;
  const record = {user_id:state.user.id,activity_type:type,title,destination:destination || '',payload};
  const {data,error} = await state.db.from('wayfarer_activity').insert(record).select('id,activity_type,title,destination,payload,created_at').single();
  if (error) {
    state.historyError = error.message;
    toast('Activity created, but history could not sync. Apply the Wayfarer history migration in Supabase.', 'warning');
    return null;
  }
  state.history.unshift(data);
  state.historyReady = true;
  renderHistory(); renderOverviewStats(); renderRecentActivity(); refreshSharePlanSelect();
  return data;
}
async function loadHistory() {
  if (!state.user || !state.db) return;
  const {data,error} = await state.db.from('wayfarer_activity').select('id,activity_type,title,destination,payload,created_at').order('created_at',{ascending:false}).limit(100);
  if (error) {
    state.historyReady = false;
    state.historyError = error.message;
    renderHistory();
    toast('History storage is not ready. Apply supabase/wayfarer-history.sql to enable saved activity.', 'warning');
    return;
  }
  state.history = data || [];
  state.historyReady = true;
  state.historyError = '';
  state.plans = state.history.filter(item => item.activity_type === 'plan' && item.payload?.plan).map(item => item.payload.plan);
  renderHistory(); renderOverviewStats(); renderRecentActivity(); refreshSharePlanSelect();
}

function renderOverviewStats() {
  const searches = state.history.filter(item => item.activity_type === 'search').length;
  const plans = state.history.filter(item => item.activity_type === 'plan').length;
  const shares = state.history.filter(item => item.activity_type === 'share').length;
  $('#statSearches').textContent = state.user ? searches : state.searchesThisSession;
  $('#statPlans').textContent = state.user ? plans : state.plans.length;
  $('#statShares').textContent = state.user ? shares : state.sharesThisSession;
  $('#statHistory').textContent = state.user ? (state.historyReady ? 'Synced' : 'Setup') : 'Guest';
}
function renderRecentActivity() {
  const host = $('#recentActivity');
  if (!host) return;
  const items = state.user ? state.history.slice(0,3) : [];
  if (!items.length) {
    host.innerHTML = '<div class="activity-empty"><span>◷</span><b>Your next idea will show up here.</b><small>Search for a place or create a trip to get started.</small></div>';
    return;
  }
  host.innerHTML = `<div class="activity-list-mini">${items.map(item => `<div class="activity-mini"><span>${item.activity_type === 'plan' ? '⌖' : '⌕'}</span><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(niceTime(item.created_at))}</small></div></div>`).join('')}</div>`;
}
function renderHistory() {
  const host = $('#historyList');
  if (!host) return;
  if (!state.user) {
    host.innerHTML = `<div class="history-empty"><span>◷</span><h3>Your guest journey is yours to explore.</h3><p>You can discover places, generate plans, and create share cards without signing in. Guest activity is not saved to permanent history. Sign in whenever you are ready to keep your searches and itineraries.</p><button class="button button-primary" id="historySignIn" style="margin-top:15px">Sign in to save history ↗</button></div>`;
    $('#historySignIn')?.addEventListener('click',() => openAuth('signin'));
    return;
  }
  if (!state.historyReady && state.historyError) {
    host.innerHTML = `<div class="history-empty"><span>⚙</span><h3>Connect your travel history.</h3><p>The signed-in account is active, but the Wayfarer history table is not available yet. Run <b>supabase/wayfarer-history.sql</b> in your Supabase SQL Editor, then refresh this page.</p><button class="button button-outline" id="historyRetry" style="margin-top:15px">Try again ↻</button></div>`;
    $('#historyRetry')?.addEventListener('click',loadHistory);
    return;
  }
  const items = state.history.filter(item => state.historyFilter === 'all' || item.activity_type === state.historyFilter);
  if (!items.length) {
    host.innerHTML = `<div class="history-empty"><span>✳</span><h3>No ${state.historyFilter === 'all' ? 'travel activity' : `${state.historyFilter === 'plan' ? 'plans' : 'searches'}`} here yet.</h3><p>Explore destinations or build your first itinerary. Your signed-in activity will appear here for you to revisit.</p><button class="button button-primary" data-history-go="${state.historyFilter === 'search' ? 'discover' : 'planner'}" style="margin-top:15px">${state.historyFilter === 'search' ? 'Discover places' : 'Build a trip'} ↗</button></div>`;
    $('[data-history-go]')?.addEventListener('click',event => switchView(event.currentTarget.dataset.historyGo));
    return;
  }
  host.innerHTML = items.map(item => `<article class="history-item"><span class="history-type-icon">${item.activity_type === 'plan' ? '⌖' : item.activity_type === 'share' ? '↗' : '⌕'}</span><div class="history-item-copy"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.destination || 'Travel idea')} · ${item.activity_type === 'plan' ? 'Itinerary' : item.activity_type === 'share' ? 'Share card' : 'Search'} </small></div><time>${escapeHtml(niceTime(item.created_at))}</time><div class="history-item-actions">${item.activity_type === 'plan' && item.payload?.plan ? `<button data-open-plan="${escapeHtml(item.id)}">Open plan</button><button data-share-plan="${escapeHtml(item.id)}">Share</button>` : ''}</div></article>`).join('');
  $$('[data-open-plan]',host).forEach(button => button.addEventListener('click',() => openHistoryPlan(button.dataset.openPlan)));
  $$('[data-share-plan]',host).forEach(button => button.addEventListener('click',() => shareHistoryPlan(button.dataset.sharePlan)));
}
function openHistoryPlan(id) {
  const record = state.history.find(item => item.id === id);
  const plan = record?.payload?.plan;
  if (!plan) return;
  state.currentPlan = plan;
  renderPlan(plan);
  switchView('planner');
  $('#generatedPlan').scrollIntoView({behavior:'smooth',block:'start'});
}
function shareHistoryPlan(id) {
  const record = state.history.find(item => item.id === id);
  if (!record?.payload?.plan) return;
  state.currentPlan = record.payload.plan;
  switchView('share');
  fillShareFromPlan(state.currentPlan);
}

function renderDestinations() {
  const query = ($('#destinationSearch')?.value || '').trim().toLowerCase();
  let list = destinations.filter(place => {
    const matchesFilter = state.filter === 'All' || place.bestFor.includes(state.filter) || place.mood === state.filter;
    const haystack = [place.name,place.country,place.region,place.mood,place.tagline,place.description,...place.bestFor,...place.highlights].join(' ').toLowerCase();
    return matchesFilter && (!query || haystack.includes(query));
  });
  if (state.sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name));
  if (state.sort === 'days') list.sort((a,b) => a.days - b.days);
  $('#resultsCount').textContent = `${list.length} ${list.length === 1 ? 'place' : 'places'} to explore`;
  const grid = $('#destinationGrid');
  if (!list.length) {
    grid.innerHTML = '<div class="no-results"><b>No exact match yet.</b><p>Try a nearby region, country, or travel mood.</p></div>';
    return;
  }
  grid.innerHTML = list.map(place => `<article class="destination-card" data-destination-card="${place.id}" tabindex="0" role="button" aria-label="View ${escapeHtml(place.name)}"><div class="destination-card-image"><img src="${place.image}" alt="${escapeHtml(place.name)} travel scene" loading="lazy"><span class="destination-tag">${escapeHtml(place.mood.toUpperCase())}</span></div><div class="destination-card-body"><div class="destination-card-heading"><div><h3>${escapeHtml(place.name)}</h3><div class="country">${escapeHtml(place.country)} · ${escapeHtml(place.region)}</div></div><span class="trip-length">${place.days} days</span></div><p>${escapeHtml(place.tagline)}</p><div class="destination-card-bottom"><span>${place.bestFor.slice(0,3).map(escapeHtml).join(' · ')}</span><b>Explore ↗</b></div></div></article>`).join('');
  $$('[data-destination-card]',grid).forEach(card => {
    const open = () => openDestination(card.dataset.destinationCard);
    card.addEventListener('click',open);
    card.addEventListener('keydown',event => {if(event.key === 'Enter' || event.key === ' '){event.preventDefault();open();}});
  });
}
function setFilter(filter) {
  state.filter = filter;
  $$('#destinationFilters [data-filter]').forEach(button => button.classList.toggle('active',button.dataset.filter === filter));
  renderDestinations();
}
async function performSearch() {
  const query = ($('#destinationSearch').value || '').trim();
  state.searchesThisSession += 1;
  renderOverviewStats();
  renderDestinations();
  if (query) await persistActivity('search',`Searched: ${query}`,query,{query,filter:state.filter});
}
function openDestination(id) {
  const place = destinations.find(item => item.id === id);
  if (!place) return;
  $('#destinationModalContent').innerHTML = `<div class="destination-detail-image"><img src="${place.image}" alt="${escapeHtml(place.name)}"><div><span class="eyebrow">${escapeHtml(place.country.toUpperCase())} · ${escapeHtml(place.mood.toUpperCase())}</span><h2>${escapeHtml(place.name)}</h2><small>${place.days} days suggested · ${escapeHtml(place.region)}</small></div></div><div class="destination-detail-content"><p>${escapeHtml(place.description)}</p><div class="destination-detail-tags">${place.bestFor.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div><b style="font-size:9px">Worth exploring</b><ul style="font-size:9px;color:var(--muted);line-height:1.9;padding-left:17px">${place.highlights.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul><div class="destination-modal-actions"><button class="button button-primary" id="planThisDestination">Plan a trip here ↗</button><button class="button button-outline" id="searchSimilar">Explore similar places</button></div></div>`;
  openModal('destinationModal');
  $('#planThisDestination').addEventListener('click',() => {
    $('#planDestination').value = `${place.name}, ${place.country}`;
    closeModal('destinationModal');
    switchView('planner');
    $('#planDestination').focus();
  });
  $('#searchSimilar').addEventListener('click',() => {
    closeModal('destinationModal');
    $('#destinationSearch').value = place.mood;
    setFilter(place.mood);
    switchView('discover');
  });
}

function defaultDates() {
  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() + 14);
  const end = new Date(start); end.setDate(end.getDate() + 4);
  $('#planStart').min = safeDate(today);
  $('#planEnd').min = safeDate(start);
  $('#planStart').value = safeDate(start);
  $('#planEnd').value = safeDate(end);
}
function interestOptions() {
  return $$('input[name="interest"]:checked').map(input => input.value);
}
function createItinerary(destination, days, interests) {
  const placeName = destination.split(',')[0].trim();
  const choices = {
    'Culture': [{title:`Walk the historic heart of ${placeName}`,desc:'Start early with the main heritage quarter, then follow smaller lanes and local architecture.'},{title:'Spend time with local craft and stories',desc:'Visit a museum, workshop, or cultural space and leave room for a slower neighbourhood walk.'}],
    'Food': [{title:'Follow a local food trail',desc:'Try a market breakfast, a regional speciality, and one place recommended by someone local.'},{title:'Make time for a long table',desc:'Choose a neighbourhood café or family-run restaurant and explore the flavours of the region.'}],
    'Nature': [{title:'Take the scenic route outdoors',desc:'Choose a well-marked park, coast path, garden, or viewpoint and build in time for breaks.'},{title:'Find a quieter landscape',desc:'Spend part of the day outside the busiest centre, with time for a short walk and photographs.'}],
    'Adventure': [{title:'Add an active experience',desc:'Consider a guided hike, cycling route, water activity, or another locally operated experience.'},{title:'Explore beyond the centre',desc:'Choose a safe, well-reviewed outdoor route and check conditions with local providers.'}],
    'Slow travel': [{title:'A gentle start and a neighbourhood wander',desc:'Begin with a relaxed breakfast, then explore on foot without trying to cover too much.'},{title:'Leave space for the unplanned',desc:'Choose one anchor stop, then let a local recommendation or a quiet side street shape the afternoon.'}],
    'Shopping': [{title:'Browse local makers and markets',desc:'Look for independent shops, artisan stalls, textiles, ceramics, or locally made souvenirs.'},{title:'A thoughtful shopping afternoon',desc:'Explore a walkable shopping district and pause for a coffee between stops.'}]
  };
  const fallback = choices['Slow travel'];
  const selected = interests.length ? interests : ['Slow travel'];
  return Array.from({length:days},(_,index)=>{
    const a = selected[index % selected.length];
    const b = selected[(index + 1) % selected.length];
    const c = selected[(index + 2) % selected.length];
    return {
      day:index+1,
      morning:choices[a]?.[index % 2] || fallback[0],
      afternoon:choices[b]?.[(index+1)%2] || fallback[1],
      evening: index === days-1 ? {title:'A final evening to remember',desc:'Choose a relaxed dinner, revisit a favourite spot, and leave time to prepare for the journey home.'} : (choices[c]?.[0] || fallback[1])
    };
  });
}
function createPlanFromForm() {
  const destination = $('#planDestination').value.trim();
  const startDate = $('#planStart').value;
  const endDate = $('#planEnd').value;
  if (!destination || !startDate || !endDate) throw new Error('Add a destination and both travel dates.');
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const today = new Date(); today.setHours(0,0,0,0);
  if (start < today) throw new Error('The start date cannot be in the past.');
  const dayCount = Math.round((end-start)/86400000)+1;
  if (!Number.isFinite(dayCount) || dayCount < 1) throw new Error('The end date must be the same as or later than the start date.');
  if (dayCount > 30) throw new Error('For a clearer itinerary, choose a trip of 30 days or fewer.');
  const travellers = Number($('#planTravellers').value) || 1;
  const budget = $('#planBudget').value;
  const budgetMap = {economy:{perDay:55,label:'Thoughtful & affordable'},balanced:{perDay:105,label:'Comfortable balance'},premium:{perDay:195,label:'A little extra comfort'}};
  const planDays = Math.min(dayCount,7);
  const interests = interestOptions();
  const daily = budgetMap[budget] || budgetMap.balanced;
  const estimate = Math.round(daily.perDay * dayCount * travellers);
  const country = destination.includes(',') ? destination.split(',').slice(1).join(',').trim() : '';
  const plan = {
    id:`plan-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    destination,country,startDate,endDate,dayCount,planDays,travellers,budget,budgetLabel:daily.label,
    interests:interests.length ? interests : ['Slow travel'],notes:$('#planNotes').value.trim(),
    budgetEstimate:estimate,budgetCurrency:'USD',
    itinerary:createItinerary(destination,planDays,interests),
    packing:['Comfortable walking shoes','Weather-appropriate layers','Reusable water bottle','Travel documents and booking details','Personal medication and essentials','Portable charger'],
    createdAt:new Date().toISOString()
  };
  if (dayCount > 7) plan.note = `The trip is ${dayCount} days long. This first outline shows the opening 7 days; generate another version or adjust dates for a more focused route.`;
  return plan;
}
function renderPlan(plan) {
  state.currentPlan = plan;
  if (!state.plans.some(item => item.id === plan.id)) state.plans.unshift(plan);
  const host = $('#generatedPlan');
  const days = plan.itinerary || [];
  host.innerHTML = `<div class="generated-plan-inner"><div class="generated-plan-head"><div><div class="eyebrow">YOUR WAYFARER ITINERARY</div><h2>${escapeHtml(plan.destination)}</h2><p>${escapeHtml(formatRange(plan.startDate,plan.endDate))} · ${plan.travellers} traveller${plan.travellers === 1 ? '' : 's'} · ${plan.dayCount} days</p></div><div class="plan-actions"><button class="button button-outline button-small" id="planShareButton">Share this plan ↗</button><button class="button button-outline button-small" id="planPrintButton">Print</button></div></div><div class="plan-summary-grid"><article><small>Suggested budget*</small><b>~$${Number(plan.budgetEstimate).toLocaleString('en-US')}</b></article><article><small>Travel style</small><b>${escapeHtml(plan.budgetLabel)}</b></article><article><small>Interests</small><b>${escapeHtml((plan.interests || []).slice(0,2).join(' · ') || 'Slow travel')}</b></article></div><div class="itinerary-days">${days.map(day=>`<article class="itinerary-day"><h4>Day ${day.day} <span style="color:var(--muted);font-size:8px;font-weight:500">· ${day.day===1?'Arrive & settle':day.day===days.length?'A final look':'Explore at your pace'}</span></h4>${[['Morning',day.morning],['Afternoon',day.afternoon],['Evening',day.evening]].map(([period,item])=>`<div class="itinerary-slot"><span>${period}</span><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.desc)}</p></div></div>`).join('')}</article>`).join('')}</div><div class="plan-bottom-grid"><section class="plan-list-card"><h4>⌁ Packing reminders</h4><ul>${plan.packing.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></section><section class="plan-list-card"><h4>✦ Your trip notes</h4><p style="color:var(--muted);font-size:8px;line-height:1.8;margin:0">${escapeHtml(plan.notes || 'No extra notes added. Keep an open slot for a local recommendation or an unexpected detour.')}</p>${plan.note ? `<p style="color:var(--amber);font-size:8px;line-height:1.6;margin:7px 0 0">${escapeHtml(plan.note)}</p>` : ''}</section></div><p class="plan-caveat">*Indicative planning estimate in USD, based on a broad daily allowance and your selected budget style. It is not a live quote and excludes flights, bookings, and destination-specific price checks. Confirm transport, opening hours, safety guidance, and current prices locally.</p></div>`;
  host.hidden = false;
  host.scrollIntoView({behavior:'smooth',block:'start'});
  $('#planShareButton').addEventListener('click',() => {switchView('share');fillShareFromPlan(plan);});
  $('#planPrintButton').addEventListener('click',() => window.print());
  refreshSharePlanSelect();
  renderOverviewStats();
}
async function submitPlanner(event) {
  event.preventDefault();
  const button = $('#generatePlan');
  button.disabled = true; button.textContent = 'Putting your route together…';
  try {
    const plan = createPlanFromForm();
    renderPlan(plan);
    await persistActivity('plan',`${plan.destination} · ${plan.dayCount}-day trip`,plan.destination,{plan});
    toast(state.user ? 'Your itinerary is ready and saved to history.' : 'Your itinerary is ready. Guest history is not saved.', 'success');
  } catch (error) {
    toast(error.message || 'Could not create this itinerary. Check the details and try again.','error');
  } finally {
    button.disabled = false; button.innerHTML = 'Create my itinerary <span>✳</span>';
  }
}

function refreshSharePlanSelect() {
  const select = $('#sharePlanSelect');
  if (!select) return;
  const allPlans = [...state.plans];
  state.history.filter(item => item.activity_type === 'plan' && item.payload?.plan).forEach(item => {
    if (!allPlans.some(plan => plan.id === item.payload.plan.id)) allPlans.push(item.payload.plan);
  });
  const previous = select.value;
  select.innerHTML = '<option value="">Choose a recent itinerary…</option>' + allPlans.map(plan => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.destination)} · ${escapeHtml(formatRange(plan.startDate,plan.endDate))}</option>`).join('');
  if (allPlans.some(plan => plan.id === previous)) select.value = previous;
}
function fillShareFromPlan(plan) {
  if (!plan) return;
  refreshSharePlanSelect();
  $('#sharePlanSelect').value = plan.id || '';
  $('#shareDestination').value = plan.destination || '';
  $('#shareDates').value = formatRange(plan.startDate,plan.endDate);
  $('#shareMood').value = plan.interests?.[0] === 'Culture' ? 'Culture & discovery' : plan.interests?.[0] === 'Nature' || plan.interests?.[0] === 'Adventure' ? 'Outdoors & open roads' : plan.interests?.[0] === 'Food' ? 'Food, friends & stories' : 'Slow days, big skies';
  $('#shareNote').value = plan.notes || 'A little escape to look forward to…';
  $('#shareDestination').focus();
}
function planById(id) {
  return state.plans.find(plan => plan.id === id) || state.history.find(item => item.activity_type === 'plan' && item.payload?.plan?.id === id)?.payload?.plan || null;
}
function cardInputData() {
  const selected = planById($('#sharePlanSelect').value);
  const destination = $('#shareDestination').value.trim() || selected?.destination || '';
  if (!destination) throw new Error('Choose a saved plan or enter a destination first.');
  return {
    destination,
    dates:$('#shareDates').value.trim() || (selected ? formatRange(selected.startDate,selected.endDate) : 'Dates to be decided'),
    mood:$('#shareMood').value,
    note:$('#shareNote').value.trim() || 'A little escape to look forward to…',
    highlights:selected?.itinerary?.slice(0,3).map(day=>day.morning.title) || [],
    plan:selected || null
  };
}
function drawCoverImage(ctx,canvas,url) {
  return new Promise(resolve => {
    if (!url) return resolve(false);
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.max(canvas.width/img.width,canvas.height/img.height);
      const w = img.width*scale,h = img.height*scale;
      ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}
function canvasRoundRect(ctx,x,y,w,h,r) {
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function wrapCanvasText(ctx,text,x,y,maxWidth,lineHeight,maxLines=3) {
  const words = String(text).split(/\s+/); let line = ''; let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line,x,y); y += lineHeight; lines++; line = word;
      if (lines >= maxLines-1) break;
    } else line = test;
  }
  if (line) {
    const remaining = words.slice(Math.max(0,words.length-5)).join(' ');
    ctx.fillText(line + (ctx.measureText(remaining).width > maxWidth ? '…' : ''),x,y);
  }
}
async function renderShareCard({track = true} = {}) {
  try {
    const data = cardInputData();
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    const place = destinations.find(item => data.destination.toLowerCase().includes(item.name.toLowerCase()));
    let photoDrawn = await drawCoverImage(ctx,canvas,place?.image);
    if (!photoDrawn) {
      const gradient = ctx.createLinearGradient(0,0,1200,1500); gradient.addColorStop(0,'#373652');gradient.addColorStop(.55,'#4d777b');gradient.addColorStop(1,'#bd806e');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,1500);
    }
    const shade = ctx.createLinearGradient(0,0,0,1500);shade.addColorStop(0,'rgba(17,20,34,.12)');shade.addColorStop(.45,'rgba(17,20,34,.16)');shade.addColorStop(1,'rgba(17,20,34,.88)');ctx.fillStyle=shade;ctx.fillRect(0,0,1200,1500);
    ctx.strokeStyle='rgba(255,255,255,.48)';ctx.lineWidth=2;canvasRoundRect(ctx,42,42,1116,1416,26);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.13)';canvasRoundRect(ctx,82,82,220,56,28);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='800 25px DM Sans, sans-serif';ctx.fillText('W  WAYFARER',105,119);
    ctx.textAlign='right';ctx.font='700 19px DM Sans, sans-serif';ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillText('A JOURNEY TO REMEMBER',1100,119);ctx.textAlign='left';
    ctx.fillStyle='#c4c0f2';ctx.font='800 22px DM Sans, sans-serif';ctx.fillText(data.mood.toUpperCase(),100,940);
    ctx.fillStyle='#fff';ctx.font='800 87px Manrope, sans-serif';
    let title = data.destination; if(ctx.measureText(title).width > 990){ctx.font='800 68px Manrope, sans-serif';}
    wrapCanvasText(ctx,title,95,1040,990,95,2);
    ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='500 31px DM Sans, sans-serif';ctx.fillText(data.dates,100,1160);
    ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='500 27px DM Sans, sans-serif';wrapCanvasText(ctx,data.note,100,1235,970,42,2);
    if (data.highlights.length) {ctx.fillStyle='#9fd0c4';ctx.font='700 20px DM Sans, sans-serif';ctx.fillText(data.highlights.slice(0,2).join('   ·   ').slice(0,70),100,1350);}
    ctx.fillStyle='rgba(255,255,255,.65)';ctx.font='700 17px DM Sans, sans-serif';ctx.fillText('FIND YOUR ROUTE. MAKE IT YOURS.',100,1405);
    state.shareCanvas = canvas; state.shareData = data;
    const preview = $('#sharePreview'); preview.innerHTML = ''; preview.appendChild(canvas);
    $('#downloadShare').disabled = false; $('#shareNative').disabled = false; $('#copyShareLink').disabled = false;
    if (track && state.user) await persistActivity('share',`Share card: ${data.destination}`,data.destination,{destination:data.destination,dates:data.dates,mood:data.mood,note:data.note});
    else if (track) state.sharesThisSession += 1;
    renderOverviewStats();
    toast('Your travel picture card is ready.', 'success');
  } catch (error) { toast(error.message || 'Could not create the share card.','error'); }
}
function makeShareUrl() {
  if (!state.shareData) throw new Error('Create a travel card before copying its link.');
  const publicData = {destination:state.shareData.destination,dates:state.shareData.dates,mood:state.shareData.mood,note:state.shareData.note,highlights:state.shareData.highlights};
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(publicData)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const url = new URL(window.location.href); url.search = '';url.hash = '';url.searchParams.set('share',encoded);
  return url.toString();
}
async function copyShareLink() {
  try {
    const url = makeShareUrl();
    await navigator.clipboard.writeText(url);
    toast('Shareable trip link copied.', 'success');
  } catch (error) {
    const url = makeShareUrl();
    window.prompt('Copy your shareable trip link:',url);
  }
}
async function downloadCard() {
  if (!state.shareCanvas) return;
  const link = document.createElement('a');link.download='wayfarer-travel-card.png';link.href=state.shareCanvas.toDataURL('image/png');link.click();
}
async function nativeShare() {
  if (!state.shareCanvas) return;
  const blob = await new Promise(resolve => state.shareCanvas.toBlob(resolve,'image/png'));
  if (!blob) return toast('Your browser could not export this card. Try Download PNG.','error');
  const file = new File([blob],'wayfarer-travel-card.png',{type:'image/png'});
  if (navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
    try { await navigator.share({title:`A trip to ${state.shareData.destination}`,text:state.shareData.note,files:[file]}); }
    catch (error) { if (error.name !== 'AbortError') toast('The share sheet could not be opened. Download the card instead.','warning'); }
  } else {
    await copyShareLink();
    toast('Your browser does not support image sharing here. The trip link was copied instead.','info');
  }
}
function openSharedLink() {
  const encoded = new URLSearchParams(window.location.search).get('share');
  if (!encoded) return;
  try {
    const normal = encoded.replace(/-/g,'+').replace(/_/g,'/');
    const decoded = decodeURIComponent(escape(atob(normal)));
    const data = JSON.parse(decoded);
    if (!data?.destination || typeof data.destination !== 'string') return;
    enterApp({session:state.session,guest:!state.user,view:'share'});
    $('#shareDestination').value = data.destination;
    $('#shareDates').value = data.dates || '';
    $('#shareMood').value = data.mood || 'Slow days, big skies';
    $('#shareNote').value = data.note || '';
    renderShareCard({track:false});
    toast('You are viewing a shared Wayfarer travel idea.', 'success');
  } catch { toast('This shared travel link could not be read.','error'); }
}

function startTour() {
  if ($('#appShell').hidden) enterApp({guest:!state.user,session:state.session});
  state.tourIndex = 0;
  showTourStep();
}
function clearTourHighlight() {
  state.tourHighlight?.classList.remove('tour-highlight');
  state.tourHighlight = null;
}
function endTour(returnToOverview = true) {
  clearTourHighlight();
  $('.tour-dim')?.remove();$('.tour-card')?.remove();
  state.tourIndex = -1;
  if (returnToOverview && !$('#appShell').hidden) switchView('overview');
}
function showTourStep() {
  if (state.tourIndex < 0) return;
  const step = tourSteps[state.tourIndex];
  if (!step) return endTour();
  switchView(step.view);
  clearTourHighlight();
  const target = $(step.selector);
  if (target) {
    state.tourHighlight = target;
    target.classList.add('tour-highlight');
    target.scrollIntoView({behavior:'smooth',block:'center'});
  }
  $('.tour-dim')?.remove();$('.tour-card')?.remove();
  const dim = document.createElement('div');dim.className='tour-dim';document.body.appendChild(dim);
  const card = document.createElement('div');card.className='tour-card';
  card.innerHTML = `<div class="tour-card-top"><span>WAYFARER FIELD GUIDE</span><span>${state.tourIndex+1} / ${tourSteps.length}</span></div><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.text)}</p><div class="tour-progress">${tourSteps.map((_,i)=>`<i class="${i<=state.tourIndex?'active':''}"></i>`).join('')}</div><div class="tour-buttons"><button data-tour-skip>Exit tour</button><div><button data-tour-back ${state.tourIndex===0?'disabled':''}>Back</button><button class="tour-next" data-tour-next>${state.tourIndex===tourSteps.length-1?'Finish':'Next step →'}</button></div></div>`;
  document.body.appendChild(card);
  $('[data-tour-skip]',card).addEventListener('click',()=>endTour());
  $('[data-tour-back]',card).addEventListener('click',()=>{if(state.tourIndex>0){state.tourIndex--;showTourStep();}});
  $('[data-tour-next]',card).addEventListener('click',()=>{if(state.tourIndex<tourSteps.length-1){state.tourIndex++;showTourStep();}else endTour();});
}

async function signOut() {
  if (state.db && state.user) {
    const {error} = await state.db.auth.signOut();
    if (error) return toast(`Could not sign out: ${error.message}`,'error');
  }
  state.user = null;state.session = null;state.history = [];state.historyReady = false;state.historyError = '';state.plans = [];state.currentPlan = null;
  showLanding();
  toast('You have signed out. Welcome back any time.','success');
}
async function handleAuthSession(session) {
  state.session = session;
  state.user = session?.user || null;
  if (state.user) {
    closeModal('authModal');
    enterApp({session,view:'overview'});
    toast('You are signed in. Your travel history is ready to sync.','success');
  }
}
async function submitEmailAuth(event) {
  event.preventDefault();
  if (!state.db) return toast('Supabase is not configured. Add a valid URL and publishable key in config.js.','error');
  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  const button = $('#emailAuthSubmit');button.disabled = true;button.textContent = state.authMode === 'signup' ? 'Creating account…' : 'Signing in…';
  try {
    let result;
    if (state.authMode === 'signup') result = await state.db.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});
    else result = await state.db.auth.signInWithPassword({email,password});
    if (result.error) throw result.error;
    if (state.authMode === 'signup' && !result.data.session) {
      $('#authMessage').textContent = 'Account created. Check your email for a confirmation link, then return here to log in.';
      toast('Check your inbox to confirm your email address.','success');
    } else if (result.data.session) await handleAuthSession(result.data.session);
  } catch (error) { toast(error.message || 'Authentication failed.','error'); }
  finally {button.disabled = false;renderAuthMode();}
}
async function signInGoogle() {
  if (!state.db) return toast('Supabase is not configured. Add a valid URL and publishable key in config.js.','error');
  const {error} = await state.db.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});
  if (error) toast(error.message || 'Google sign-in could not start.','error');
}

function wireEvents() {
  $('#landingTheme').addEventListener('click',toggleTheme);
  $('#appTheme').addEventListener('click',toggleTheme);
  $('#headerLogin').addEventListener('click',()=>openAuth('signin'));
  $('#headerSignup').addEventListener('click',()=>openAuth('signup'));
  $('#heroGetStarted').addEventListener('click',()=>openAuth('signin'));
  $('#heroGuest').addEventListener('click',()=>enterApp({guest:true}));
  $('#heroGoogle').addEventListener('click',signInGoogle);
  $('#ctaExplore').addEventListener('click',()=>enterApp({guest:true}));
  $('#ctaSignIn').addEventListener('click',()=>openAuth('signin'));
  $('#howTourButton').addEventListener('click',startTour);
  $('#mobileNavToggle').addEventListener('click',()=>$('#siteHeader').classList.toggle('mobile-open'));
  $('#toggleAuthMode').addEventListener('click',()=>{state.authMode=state.authMode==='signin'?'signup':'signin';renderAuthMode();});
  $('#emailAuthForm').addEventListener('submit',submitEmailAuth);
  $('#googleSignIn').addEventListener('click',signInGoogle);
  $('#topAccountButton').addEventListener('click',()=>state.user?switchView('settings'):openAuth('signin'));
  $('#profileMenu').addEventListener('click',()=>switchView('settings'));
  $('#settingsAccountAction').addEventListener('click',()=>openAuth('signin'));
  $('#signOutButton').addEventListener('click',signOut);
  $('#sidebarToggle').addEventListener('click',()=>$('#appSidebar').classList.toggle('open'));
  $('#sidebarTour').addEventListener('click',startTour);
  $('#startTourFromGuide').addEventListener('click',startTour);
  $$('[data-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
  $$('[data-open-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.openView)));
  $$('[data-guide-target]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.guideTarget)));
  $$('.theme-choice').forEach(button=>button.addEventListener('click',()=>applyTheme(button.dataset.themeChoice)));
  $$('.mood-tile').forEach(button=>button.addEventListener('click',()=>{switchView('discover');$('#destinationSearch').value='';setFilter(button.dataset.mood);}));
  $('#searchDestinations').addEventListener('click',performSearch);
  $('#destinationSearch').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();performSearch();}});
  $('#destinationSearch').addEventListener('input',renderDestinations);
  $('#clearSearch').addEventListener('click',()=>{$('#destinationSearch').value='';renderDestinations();});
  $('#destinationFilters').addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(button)setFilter(button.dataset.filter);});
  $('#sortDestinations').addEventListener('change',event=>{state.sort=event.target.value;renderDestinations();});
  $('#plannerForm').addEventListener('submit',submitPlanner);
  $('#planStart').addEventListener('change',()=>{const next = new Date(`${$('#planStart').value}T12:00:00`);if(!Number.isNaN(next.getTime())){$('#planEnd').min=$('#planStart').value;if($('#planEnd').value && $('#planEnd').value < $('#planStart').value)$('#planEnd').value=$('#planStart').value;}});
  $$('.segmented-tabs [data-history-filter]').forEach(button=>button.addEventListener('click',()=>{state.historyFilter=button.dataset.historyFilter;$$('.segmented-tabs [data-history-filter]').forEach(item=>item.classList.toggle('active',item===button));renderHistory();}));
  $('#refreshHistory').addEventListener('click',loadHistory);
  $('#sharePlanSelect').addEventListener('change',event=>{const plan=planById(event.target.value);if(plan)fillShareFromPlan(plan);});
  $('#renderShareCard').addEventListener('click',renderShareCard);
  $('#downloadShare').addEventListener('click',downloadCard);
  $('#shareNative').addEventListener('click',nativeShare);
  $('#copyShareLink').addEventListener('click',copyShareLink);
  $$('[data-close]').forEach(button=>button.addEventListener('click',()=>closeModal(button.dataset.close)));
  $$('.modal-backdrop').forEach(backdrop=>backdrop.addEventListener('click',event=>{if(event.target===backdrop)closeModal(backdrop.id);}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(state.tourIndex>=0)endTour();$$('.modal-backdrop.open').forEach(modal=>closeModal(modal.id));}});
}

async function init() {
  $('#yearNow').textContent = new Date().getFullYear();
  let theme='dark';try{theme=localStorage.getItem('wayfarer-theme')||'dark';}catch{}
  applyTheme(theme,false);
  defaultDates();
  wireEvents();
  renderDestinations();
  $('#overviewDestinations').innerHTML = destinations.slice(0,3).map(place=>`<button class="destination-mini" data-mini-destination="${place.id}"><img src="${place.image}" alt="" loading="lazy"><span><b>${escapeHtml(place.name)}</b><small>${escapeHtml(place.country)} · ${place.days} days</small></span></button>`).join('');
  $$('[data-mini-destination]').forEach(button=>button.addEventListener('click',()=>{switchView('discover');openDestination(button.dataset.miniDestination);}));
  if (supabaseConfigured()) {
    try {
      state.db = createClient(supabaseConfig.url,supabaseConfig.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      state.db.auth.onAuthStateChange((event,session)=>{
        if (event === 'SIGNED_IN' && session?.user && !state.user) void handleAuthSession(session);
        if (event === 'SIGNED_OUT') {state.user=null;state.session=null;state.history=[];state.historyReady=false;updateAccountUI();}
        if (event === 'TOKEN_REFRESHED') {state.session=session;state.user=session?.user||null;}
      });
      const {data,error}=await state.db.auth.getSession();
      if (error) throw error;
      if (data.session?.user) {
        state.session=data.session;state.user=data.session.user;
        enterApp({session:data.session,view:'overview'});
      }
    } catch (error) {
      console.warn('Wayfarer auth could not initialise:',error);
      toast('Account connection could not be initialised. Guest mode is still available.','warning');
    }
  }
  openSharedLink();
  renderAuthMode();
}

init();
