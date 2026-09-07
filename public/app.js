const API_URL='/.netlify/functions/api';

const state={
  sessionToken:sessionStorage.getItem('khGsrSession')||'',
  user:null,
  verticals:[],
  canApprove:false,
  restoreSearchInput:'',
  restoreHistoryLoaded:false
};

const $=id=>document.getElementById(id);

async function api(action,data={}){
  const response=await fetch(API_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      action,
      sessionToken:state.sessionToken,
      ...data
    })
  });

  let result;

  try{
    result=await response.json();
  }catch{
    throw new Error(
      'The portal received an invalid server response.'
    );
  }

  if(!response.ok||!result.ok){
    throw new Error(
      result.error||'Request failed.'
    );
  }

  return result;
}

function busy(show,text='Processing…'){
  $('overlayText').textContent=text;
  $('overlay').classList.toggle('hidden',!show);
}

function setMessage(id,text='',type=''){
  const node=$(id);
  node.textContent=text;
  node.className='message'+(type?' '+type:'');
}

function escapeHtml(value){
  return String(value==null?'':value).replace(
    /[&<>"']/g,
    ch=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    })[ch]
  );
}

function formatDate(value){
  if(!value)return'';

  const d=new Date(value);

  if(Number.isNaN(d.getTime())){
    return value;
  }

  return d.toLocaleString(
    'en-IN',
    {
      dateStyle:'medium',
      timeStyle:'short'
    }
  );
}

function badge(status){
  const text=escapeHtml(status||'');

  return(
    '<span class="badge '+text+'">'+
    text.replaceAll('_',' ')+
    '</span>'
  );
}

function formatRole(role){
  const value=String(role||'').toUpperCase();

  if(value==='VERTICAL_HEAD')return'Vertical Head';
  if(value==='SUPERADMIN')return'SuperAdmin';
  if(value==='ADMIN')return'Admin';

  return'User';
}

function deriveOldEmail(email){
  const parts=String(email||'').split('@');

  return parts.length===2
    ? 'old.'+parts[0]+'@'+parts[1]
    : '';
}

function handleSessionError(err){
  const text=String(err?.message||'').toLowerCase();

  if(
    text.includes('session has expired')||
    text.includes('access is no longer active')
  ){
    clearLocalSession();
    setTimeout(()=>location.reload(),250);
  }
}

async function sendOtp(){
  const email=$('email').value.trim().toLowerCase();

  if(!email){
    setMessage('loginMessage','Enter your work email.','error');
    return;
  }

  busy(true,'Sending OTP…');

  try{
    const out=await api('requestOtp',{email});

    $('otpArea').classList.remove('hidden');

    setMessage(
      'loginMessage',
      out.message,
      'success'
    );

    $('otp').focus();

  }catch(err){
    setMessage('loginMessage',err.message,'error');

  }finally{
    busy(false);
  }
}

async function verifyOtp(){
  const email=$('email').value.trim().toLowerCase();
  const otp=$('otp').value.trim();

  busy(true,'Verifying OTP…');

  try{
    const out=await api('verifyOtp',{email,otp});

    state.sessionToken=out.sessionToken;
    state.user=out.user;

    sessionStorage.setItem(
      'khGsrSession',
      state.sessionToken
    );

    showApplication();
    await refreshApplication();

  }catch(err){
    setMessage('loginMessage',err.message,'error');

  }finally{
    busy(false);
  }
}

async function restoreSession(){
  if(!state.sessionToken)return;

  try{
    const out=await api('me');
    state.user=out.user;

    showApplication();
    await refreshApplication();

  }catch{
    clearLocalSession();
  }
}

function showApplication(){
  $('loginCard').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('logoutBtn').classList.remove('hidden');

  $('userName').textContent=
    state.user.name||state.user.email;

  $('userMeta').textContent=
    state.user.email+' | '+formatRole(state.user.role);

  $('oldEmailHint').textContent=
    deriveOldEmail(state.user.email);
}

async function logoutUser(){
  try{
    if(state.sessionToken){
      await api('logout');
    }
  }catch(err){
    console.warn(err);
  }finally{
    clearLocalSession();
    location.reload();
  }
}

function clearLocalSession(){
  state.sessionToken='';
  state.user=null;
  state.verticals=[];
  state.canApprove=false;
  state.restoreHistoryLoaded=false;

  sessionStorage.removeItem('khGsrSession');
}

async function loadPortalConfig(){
  const out=await api('portalConfig');

  state.user=out.user;
  state.verticals=out.verticals||[];
  state.canApprove=Boolean(out.canApprove);

  renderVerticals();

  $('approvalArea').classList.toggle(
    'hidden',
    !state.canApprove
  );

  $('userName').textContent=
    state.user.name||state.user.email;

  $('userMeta').textContent=
    state.user.email+' | '+formatRole(state.user.role);

  $('oldEmailHint').textContent=
    deriveOldEmail(state.user.email);
}


/* WORKFLOW SWITCH */

function showWorkflow(name){
  const create=name==='create';

  $('createPanel').classList.toggle('hidden',!create);
  $('restorePanel').classList.toggle('hidden',create);

  $('showCreateBtn').classList.toggle('active',create);
  $('showRestoreBtn').classList.toggle('active',!create);

  if(!create&&!state.restoreHistoryLoaded){
    loadRestoreHistoryUi();
  }
}

function setRestoreMethod(method){
  const name=method==='name';

  $('nameMethod').classList.toggle('hidden',!name);
  $('urlMethod').classList.toggle('hidden',name);

  $('methodNameBtn').classList.toggle('active',name);
  $('methodUrlBtn').classList.toggle('active',!name);

  setMessage('restoreSearchMessage','');
  setMessage('restoreUrlMessage','');
}


/* NEW SHEET */

function renderVerticals(){
  const select=$('vertical');
  const current=select.value;

  select.innerHTML=
    '<option value="">Select vertical</option>'+
    state.verticals.map(v=>
      '<option value="'+escapeHtml(v.vertical)+'">'+
      escapeHtml(v.vertical)+
      '</option>'
    ).join('');

  if(
    current&&
    state.verticals.some(v=>v.vertical===current)
  ){
    select.value=current;
  }

  updateApproverHint();
}

function updateApproverHint(){
  const selected=$('vertical').value;

  const vertical=state.verticals.find(
    v=>v.vertical===selected
  );

  const hint=$('approverHint');

  if(!vertical){
    hint.textContent='';
    hint.classList.add('hidden');
    return;
  }

  const approvers=[];

  if(vertical.approverName1||vertical.approverEmail1){
    approvers.push(
      vertical.approverName1||vertical.approverEmail1
    );
  }

  if(vertical.approverName2||vertical.approverEmail2){
    approvers.push(
      vertical.approverName2||vertical.approverEmail2
    );
  }

  hint.textContent=
    approvers.length>1
      ? 'Approval will go to: '+
        approvers.join(' or ')+
        '. The first decision completes the request.'
      : 'Approval will go to: '+
        (approvers[0]||'Configured Vertical Head');

  hint.classList.remove('hidden');
}

async function submitRequest(){
  const sheetName=$('sheetName').value.trim();
  const purpose=$('purpose').value.trim();
  const vertical=$('vertical').value;

  if(!sheetName||!purpose||!vertical){
    setMessage(
      'requestMessage',
      'Google Sheet name, purpose and vertical are required.',
      'error'
    );
    return;
  }

  busy(true,'Submitting request…');

  try{
    const out=await api(
      'submitRequest',
      {
        sheetName,
        purpose,
        vertical
      }
    );

    $('sheetName').value='';
    $('purpose').value='';
    $('vertical').value='';

    updateApproverHint();

    setMessage(
      'requestMessage',
      out.requestId+
      ' submitted successfully. Approver: '+
      out.approver,
      'success'
    );

    await loadMyRequests();

    if(state.canApprove){
      await loadApprovalQueue();
    }

  }catch(err){
    handleSessionError(err);
    setMessage('requestMessage',err.message,'error');

  }finally{
    busy(false);
  }
}

async function loadMyRequests(){
  const out=await api('myRequests');
  const body=$('myRequestsBody');

  if(!out.requests.length){
    body.innerHTML=
      '<tr><td colspan="5" class="muted">'+
      'No requests submitted yet.'+
      '</td></tr>';
    return;
  }

  body.innerHTML=out.requests.map(r=>{
    const note=r.adminNote
      ? '<br><span class="muted">'+
        escapeHtml(r.adminNote)+
        '</span>'
      : '';

    const action=r.sheetUrl
      ? '<a class="link" target="_blank" rel="noopener" href="'+
        escapeHtml(r.sheetUrl)+
        '">Open Sheet</a>'
      : '-';

    return`
      <tr>
        <td>
          <strong>${escapeHtml(r.requestId)}</strong><br>
          <span class="muted">${escapeHtml(formatDate(r.requestedAt))}</span>
        </td>
        <td>${escapeHtml(r.vertical||'-')}</td>
        <td>${escapeHtml(r.sheetName)}${note}</td>
        <td>${badge(r.status)}</td>
        <td>${action}</td>
      </tr>
    `;
  }).join('');
}


/* RESTORE */

async function searchRestore(){
  const query=$('restoreName').value.trim();

  if(query.length<3){
    setMessage(
      'restoreSearchMessage',
      'Enter at least 3 characters of the Sheet name.',
      'error'
    );
    return;
  }

  state.restoreSearchInput=query;

  busy(true,'Searching your previous Sheets…');

  try{
    const out=await api('restoreSearch',{query});

    setMessage(
      'restoreSearchMessage',
      out.message,
      out.results.length?'success':''
    );

    renderRestoreResults(out.results);

  }catch(err){
    handleSessionError(err);
    setMessage('restoreSearchMessage',err.message,'error');

  }finally{
    busy(false);
  }
}

function renderRestoreResults(results){
  const body=$('restoreResultsBody');

  if(!results.length){
    body.innerHTML=
      '<tr><td colspan="4" class="muted">'+
      'No matching Sheet with verified previous access was found.'+
      '</td></tr>';
    return;
  }

  body.innerHTML=results.map(r=>`
    <tr>
      <td><strong>${escapeHtml(r.name)}</strong></td>
      <td>${escapeHtml(formatDate(r.modifiedTime))}</td>
      <td>${escapeHtml(r.previousAccess||'')}</td>
      <td>
        <button
          class="btn primary small"
          data-restore-file="${escapeHtml(r.fileId)}">
          Restore Access
        </button>
      </td>
    </tr>
  `).join('');

  body
    .querySelectorAll('[data-restore-file]')
    .forEach(button=>{
      button.addEventListener(
        'click',
        ()=>restoreSelected(button.dataset.restoreFile)
      );
    });
}

async function restoreSelected(fileId){
  if(!confirm(
    'Restore your verified previous access to this Google Sheet?'
  )){
    return;
  }

  busy(true,'Verifying and restoring access…');

  try{
    const out=await api(
      'restoreSelected',
      {
        fileId,
        searchInput:state.restoreSearchInput
      }
    );

    showRestoreResult(out);
    await loadRestoreHistory();

  }catch(err){
    handleSessionError(err);
    alert(err.message);

  }finally{
    busy(false);
  }
}

async function restoreByUrl(){
  const url=$('restoreUrl').value.trim();

  if(!url){
    setMessage(
      'restoreUrlMessage',
      'Paste the Google Sheet URL.',
      'error'
    );
    return;
  }

  busy(true,'Verifying previous access…');

  try{
    const out=await api('restoreByUrl',{url});

    const type=
      out.status==='DENIED'
        ? 'error'
        : 'success';

    setMessage(
      'restoreUrlMessage',
      out.message,
      type
    );

    if(
      out.fileUrl&&
      out.status!=='DENIED'
    ){
      $('restoreUrlMessage').innerHTML=
        escapeHtml(out.message)+
        ' <a class="link" target="_blank" rel="noopener" href="'+
        escapeHtml(out.fileUrl)+
        '">Open Sheet</a>';
    }

    await loadRestoreHistory();

  }catch(err){
    handleSessionError(err);
    setMessage('restoreUrlMessage',err.message,'error');

  }finally{
    busy(false);
  }
}

function showRestoreResult(out){
  if(out.status==='DENIED'){
    alert(out.message);
    return;
  }

  const access=
    out.restoredAccess||
    out.previousAccess||
    '';

  const text=
    out.message+
    (access?' Access: '+access+'.':'');

  if(out.fileUrl){
    if(confirm(text+'\n\nOpen the Google Sheet now?')){
      window.open(
        out.fileUrl,
        '_blank',
        'noopener'
      );
    }
  }else{
    alert(text);
  }
}

async function loadRestoreHistory(){
  const out=await api('restoreHistory');

  state.restoreHistoryLoaded=true;

  const body=$('restoreHistoryBody');

  if(!out.history.length){
    body.innerHTML=
      '<tr><td colspan="5" class="muted">'+
      'No access restore requests yet.'+
      '</td></tr>';
    return;
  }

  body.innerHTML=out.history.map(r=>{
    const action=
      r.fileUrl&&r.status!=='DENIED'
        ? '<a class="link" target="_blank" rel="noopener" href="'+
          escapeHtml(r.fileUrl)+
          '">Open Sheet</a>'
        : '-';

    return`
      <tr>
        <td>
          <strong>${escapeHtml(r.restoreId)}</strong><br>
          <span class="muted">${escapeHtml(formatDate(r.requestedAt))}</span>
        </td>
        <td>
          ${escapeHtml(r.fileName||'-')}<br>
          <span class="muted">${escapeHtml(r.message||'')}</span>
        </td>
        <td>${escapeHtml(r.previousAccess||'-')}</td>
        <td>${badge(r.status)}</td>
        <td>${action}</td>
      </tr>
    `;
  }).join('');
}

async function loadRestoreHistoryUi(){
  busy(true,'Loading restore history…');

  try{
    await loadRestoreHistory();

  }catch(err){
    handleSessionError(err);
    alert(err.message);

  }finally{
    busy(false);
  }
}


/* APPROVAL */

async function loadApprovalQueue(){
  if(!state.canApprove)return;

  const out=await api(
    'approvalDashboard',
    {
      status:$('approvalFilter').value
    }
  );

  $('approvalScope').textContent=
    out.scope==='ALL'
      ? 'Showing all requests — Admin/SuperAdmin oversight'
      : 'Showing only requests routed to you';

  $('statPending').textContent=out.summary.pending;
  $('statApproved').textContent=out.summary.approved;
  $('statRejected').textContent=out.summary.rejected;
  $('statError').textContent=out.summary.error;

  const body=$('approvalRequestsBody');

  if(!out.requests.length){
    body.innerHTML=
      '<tr><td colspan="7" class="muted">'+
      'No requests in this view.'+
      '</td></tr>';
    return;
  }

  body.innerHTML=out.requests.map(r=>{
    const status=String(r.status||'').toUpperCase();

    const canApproveNow=
      ['PENDING','ERROR','PROVISIONING'].includes(status);

    const canRejectNow=
      !['APPROVED','REJECTED'].includes(status);

    let actions='<div class="actions">';

    if(r.sheetUrl){
      actions+=
        '<a class="btn secondary small" target="_blank" rel="noopener" href="'+
        escapeHtml(r.sheetUrl)+
        '">Open</a>';
    }

    if(canApproveNow){
      actions+=
        '<button class="btn primary small" data-approve="'+
        escapeHtml(r.requestId)+
        '">Approve</button>';
    }

    if(canRejectNow){
      actions+=
        '<button class="btn danger small" data-reject="'+
        escapeHtml(r.requestId)+
        '">Reject</button>';
    }

    actions+='</div>';

    const decision=[
      r.actionBy
        ? 'By: '+escapeHtml(r.actionBy)
        : '',
      r.adminNote
        ? escapeHtml(r.adminNote)
        : ''
    ].filter(Boolean).join('<br>');

    return`
      <tr>
        <td>
          <strong>${escapeHtml(r.requestId)}</strong><br>
          <span class="muted">${escapeHtml(formatDate(r.requestedAt))}</span>
        </td>
        <td>${escapeHtml(r.vertical||'-')}</td>
        <td>
          ${escapeHtml(r.requesterName)}<br>
          <span class="muted">${escapeHtml(r.requesterEmail)}</span>
        </td>
        <td>
          <strong>${escapeHtml(r.sheetName)}</strong><br>
          <span class="muted">${escapeHtml(r.purpose)}</span>
        </td>
        <td>${badge(r.status)}</td>
        <td>${decision||'-'}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('[data-approve]').forEach(button=>{
    button.addEventListener(
      'click',
      ()=>approveRequest(button.dataset.approve)
    );
  });

  body.querySelectorAll('[data-reject]').forEach(button=>{
    button.addEventListener(
      'click',
      ()=>rejectRequest(button.dataset.reject)
    );
  });
}

async function approveRequest(requestId){
  if(!confirm(
    'Approve '+requestId+'?\n\nThe system will create the Google Sheet and share it with the requester as Editor.'
  )){
    return;
  }

  busy(true,'Creating and sharing Google Sheet…');

  try{
    const out=await api('approveRequest',{requestId});

    alert(out.message);
    await refreshApplication();

  }catch(err){
    handleSessionError(err);
    alert(err.message);

  }finally{
    busy(false);
  }
}

async function rejectRequest(requestId){
  const reason=prompt(
    'Reason for rejecting '+requestId+':'
  );

  if(!reason||!reason.trim())return;

  busy(true,'Rejecting request…');

  try{
    const out=await api(
      'rejectRequest',
      {
        requestId,
        reason:reason.trim()
      }
    );

    alert(out.message);
    await refreshApplication();

  }catch(err){
    handleSessionError(err);
    alert(err.message);

  }finally{
    busy(false);
  }
}


/* REFRESH */

async function refreshApplication(){
  await loadPortalConfig();
  await loadMyRequests();

  if(state.canApprove){
    await loadApprovalQueue();
  }
}

async function refreshMineUi(){
  busy(true,'Refreshing…');

  try{
    await loadMyRequests();

  }catch(err){
    handleSessionError(err);
    alert(err.message);

  }finally{
    busy(false);
  }
}

async function refreshApprovalUi(){
  busy(true,'Refreshing approval queue…');

  try{
    await loadApprovalQueue();

  }catch(err){
    handleSessionError(err);
    alert(err.message);

  }finally{
    busy(false);
  }
}


/* EVENTS */

$('sendOtpBtn').addEventListener('click',sendOtp);
$('verifyOtpBtn').addEventListener('click',verifyOtp);
$('submitRequestBtn').addEventListener('click',submitRequest);
$('refreshMineBtn').addEventListener('click',refreshMineUi);
$('refreshApprovalBtn').addEventListener('click',refreshApprovalUi);
$('vertical').addEventListener('change',updateApproverHint);

$('showCreateBtn').addEventListener(
  'click',
  ()=>showWorkflow('create')
);

$('showRestoreBtn').addEventListener(
  'click',
  ()=>showWorkflow('restore')
);

$('methodNameBtn').addEventListener(
  'click',
  ()=>setRestoreMethod('name')
);

$('methodUrlBtn').addEventListener(
  'click',
  ()=>setRestoreMethod('url')
);

$('searchRestoreBtn').addEventListener('click',searchRestore);
$('restoreUrlBtn').addEventListener('click',restoreByUrl);
$('refreshRestoreHistoryBtn').addEventListener('click',loadRestoreHistoryUi);

$('approvalFilter').addEventListener(
  'change',
  async()=>{
    try{
      await loadApprovalQueue();
    }catch(err){
      handleSessionError(err);
      alert(err.message);
    }
  }
);

$('logoutBtn').addEventListener('click',logoutUser);

$('otp').addEventListener(
  'keydown',
  event=>{
    if(event.key==='Enter'){
      verifyOtp();
    }
  }
);

$('restoreName').addEventListener(
  'keydown',
  event=>{
    if(event.key==='Enter'){
      searchRestore();
    }
  }
);

$('restoreUrl').addEventListener(
  'keydown',
  event=>{
    if(event.key==='Enter'){
      restoreByUrl();
    }
  }
);

restoreSession();
