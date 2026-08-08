const API_URL =
  '/.netlify/functions/api';

const state = {
  sessionToken:
    sessionStorage.getItem(
      'khGsrSession'
    ) || '',
  user: null
};

const $ =
  id =>
    document.getElementById(id);


async function api(
  action,
  data = {}
) {
  const response =
    await fetch(
      API_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify({
          action,
          sessionToken:
            state.sessionToken,
          ...data
        })
      }
    );

  let result;

  try {
    result =
      await response.json();
  } catch {
    throw new Error(
      'Invalid server response.'
    );
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      result.error ||
      'Request failed.'
    );
  }

  return result;
}


function busy(
  show,
  text = 'Processing…'
) {
  $('overlayText').textContent =
    text;

  $('overlay')
    .classList
    .toggle(
      'hidden',
      !show
    );
}


function setMessage(
  id,
  text = '',
  type = ''
) {
  const node = $(id);

  node.textContent =
    text;

  node.className =
    'message' +
    (type
      ? ' ' + type
      : '');
}


function escapeHtml(value) {
  return String(
    value == null
      ? ''
      : value
  ).replace(
    /[&<>"']/g,
    ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    })[ch]
  );
}


function formatDate(value) {
  if (!value) return '';

  const d =
    new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
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


function statusBadge(status) {
  const s =
    escapeHtml(
      status || ''
    );

  return (
    '<span class="badge ' +
    s +
    '">' +
    s +
    '</span>'
  );
}


function isAdmin() {
  return Boolean(
    state.user &&
    [
      'ADMIN',
      'SUPERADMIN'
    ].includes(
      String(
        state.user.role || ''
      ).toUpperCase()
    )
  );
}


function handleSessionError(err) {
  const text =
    String(
      err &&
      err.message
        ? err.message
        : ''
    ).toLowerCase();

  if (
    text.includes(
      'session has expired'
    ) ||
    text.includes(
      'access is no longer active'
    )
  ) {
    clearLocalSession();

    setTimeout(
      () =>
        location.reload(),
      300
    );
  }
}


async function sendOtp() {
  const email =
    $('email')
      .value
      .trim()
      .toLowerCase();

  if (!email) {
    setMessage(
      'loginMessage',
      'Enter your work email.',
      'error'
    );

    return;
  }

  busy(
    true,
    'Sending OTP…'
  );

  try {
    const out =
      await api(
        'requestOtp',
        { email }
      );

    $('otpArea')
      .classList
      .remove('hidden');

    setMessage(
      'loginMessage',
      out.message,
      'success'
    );

    $('otp').focus();

  } catch (err) {
    setMessage(
      'loginMessage',
      err.message,
      'error'
    );

  } finally {
    busy(false);
  }
}


async function verifyOtp() {
  const email =
    $('email')
      .value
      .trim()
      .toLowerCase();

  const otp =
    $('otp')
      .value
      .trim();

  busy(
    true,
    'Verifying OTP…'
  );

  try {
    const out =
      await api(
        'verifyOtp',
        {
          email,
          otp
        }
      );

    state.sessionToken =
      out.sessionToken;

    state.user =
      out.user;

    sessionStorage
      .setItem(
        'khGsrSession',
        state.sessionToken
      );

    showApplication();

    await refreshApplication();

  } catch (err) {
    setMessage(
      'loginMessage',
      err.message,
      'error'
    );

  } finally {
    busy(false);
  }
}


async function restoreSession() {
  if (!state.sessionToken) {
    return;
  }

  try {
    const out =
      await api('me');

    state.user =
      out.user;

    showApplication();

    await refreshApplication();

  } catch {
    clearLocalSession();
  }
}


function showApplication() {
  $('loginCard')
    .classList
    .add('hidden');

  $('app')
    .classList
    .remove('hidden');

  $('logoutBtn')
    .classList
    .remove('hidden');

  $('userName').textContent =
    state.user.name ||
    state.user.email;

  $('userMeta').textContent =
    state.user.email +
    ' | ' +
    state.user.role;

  $('adminArea')
    .classList
    .toggle(
      'hidden',
      !isAdmin()
    );
}


async function logoutUser() {
  try {
    if (state.sessionToken) {
      await api('logout');
    }
  } catch (err) {
    console.warn(err);
  } finally {
    clearLocalSession();
    location.reload();
  }
}


function clearLocalSession() {
  state.sessionToken = '';
  state.user = null;

  sessionStorage
    .removeItem(
      'khGsrSession'
    );
}


async function submitRequest() {
  const sheetName =
    $('sheetName')
      .value
      .trim();

  const purpose =
    $('purpose')
      .value
      .trim();

  if (
    !sheetName ||
    !purpose
  ) {
    setMessage(
      'requestMessage',
      'Google Sheet name and purpose are required.',
      'error'
    );

    return;
  }

  busy(
    true,
    'Submitting request…'
  );

  try {
    const out =
      await api(
        'submitRequest',
        {
          sheetName,
          purpose
        }
      );

    $('sheetName').value = '';
    $('purpose').value = '';

    setMessage(
      'requestMessage',
      out.requestId +
      ' submitted successfully.',
      'success'
    );

    await loadMyRequests();

    if (isAdmin()) {
      await loadAdmin();
    }

  } catch (err) {
    handleSessionError(err);

    setMessage(
      'requestMessage',
      err.message,
      'error'
    );

  } finally {
    busy(false);
  }
}


async function loadMyRequests() {
  const out =
    await api(
      'myRequests'
    );

  const body =
    $('myRequestsBody');

  if (!out.requests.length) {
    body.innerHTML =
      '<tr>' +
      '<td colspan="4" class="muted">' +
      'No requests submitted yet.' +
      '</td>' +
      '</tr>';

    return;
  }

  body.innerHTML =
    out.requests
      .map(r => {
        const note =
          r.adminNote
            ? (
              '<br>' +
              '<span class="muted">' +
              escapeHtml(
                r.adminNote
              ) +
              '</span>'
            )
            : '';

        const action =
          r.sheetUrl
            ? (
              '<a class="link" ' +
              'target="_blank" ' +
              'rel="noopener" ' +
              'href="' +
              escapeHtml(
                r.sheetUrl
              ) +
              '">' +
              'Open Sheet' +
              '</a>'
            )
            : '-';

        return `
          <tr>
            <td>
              <strong>
                ${escapeHtml(r.requestId)}
              </strong>
              <br>
              <span class="muted">
                ${escapeHtml(formatDate(r.requestedAt))}
              </span>
            </td>

            <td>
              ${escapeHtml(r.sheetName)}
              ${note}
            </td>

            <td>
              ${statusBadge(r.status)}
            </td>

            <td>
              ${action}
            </td>
          </tr>
        `;
      })
      .join('');
}


async function loadAdmin() {
  if (!isAdmin()) return;

  const out =
    await api(
      'adminDashboard',
      {
        status:
          $('adminFilter').value
      }
    );

  $('statPending').textContent =
    out.summary.pending;

  $('statApproved').textContent =
    out.summary.approved;

  $('statRejected').textContent =
    out.summary.rejected;

  $('statError').textContent =
    out.summary.error;

  const body =
    $('adminRequestsBody');

  if (!out.requests.length) {
    body.innerHTML =
      '<tr>' +
      '<td colspan="6" class="muted">' +
      'No requests in this view.' +
      '</td>' +
      '</tr>';

    return;
  }

  body.innerHTML =
    out.requests
      .map(r => {
        const status =
          String(
            r.status || ''
          ).toUpperCase();

        const canApprove =
          [
            'PENDING',
            'ERROR',
            'PROVISIONING'
          ].includes(status);

        const canReject =
          ![
            'APPROVED',
            'REJECTED'
          ].includes(status);

        let actions =
          '<div class="actions">';

        if (r.sheetUrl) {
          actions +=
            '<a class="btn secondary small" ' +
            'target="_blank" ' +
            'rel="noopener" ' +
            'href="' +
            escapeHtml(r.sheetUrl) +
            '">' +
            'Open' +
            '</a>';
        }

        if (canApprove) {
          actions +=
            '<button ' +
            'class="btn primary small" ' +
            'data-approve="' +
            escapeHtml(r.requestId) +
            '">' +
            'Approve' +
            '</button>';
        }

        if (canReject) {
          actions +=
            '<button ' +
            'class="btn danger small" ' +
            'data-reject="' +
            escapeHtml(r.requestId) +
            '">' +
            'Reject' +
            '</button>';
        }

        actions +=
          '</div>';

        return `
          <tr>

            <td>
              <strong>
                ${escapeHtml(r.requestId)}
              </strong>
              <br>
              <span class="muted">
                ${escapeHtml(formatDate(r.requestedAt))}
              </span>
            </td>

            <td>
              ${escapeHtml(r.requesterName)}
              <br>
              <span class="muted">
                ${escapeHtml(r.requesterEmail)}
              </span>
            </td>

            <td>
              <strong>
                ${escapeHtml(r.sheetName)}
              </strong>
              <br>
              <span class="muted">
                ${escapeHtml(r.purpose)}
              </span>
            </td>

            <td>
              ${statusBadge(r.status)}
            </td>

            <td>
              ${escapeHtml(r.adminNote || '')}
            </td>

            <td>
              ${actions}
            </td>

          </tr>
        `;
      })
      .join('');

  body
    .querySelectorAll(
      '[data-approve]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () =>
          approveRequest(
            button.dataset.approve
          )
      );
    });

  body
    .querySelectorAll(
      '[data-reject]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () =>
          rejectRequest(
            button.dataset.reject
          )
      );
    });
}


async function approveRequest(
  requestId
) {
  const confirmed =
    confirm(
      'Approve ' +
      requestId +
      '?\n\n' +
      'A Google Sheet will be created under the Google deployment owner, kept Restricted, and the requester will be added as Editor.'
    );

  if (!confirmed) return;

  busy(
    true,
    'Creating and sharing Google Sheet…'
  );

  try {
    const out =
      await api(
        'approveRequest',
        { requestId }
      );

    alert(out.message);

    await refreshApplication();

  } catch (err) {
    handleSessionError(err);
    alert(err.message);

    if (state.sessionToken) {
      try {
        await loadAdmin();
      } catch {}
    }

  } finally {
    busy(false);
  }
}


async function rejectRequest(
  requestId
) {
  const reason =
    prompt(
      'Reason for rejecting ' +
      requestId +
      ':'
    );

  if (
    !reason ||
    !reason.trim()
  ) {
    return;
  }

  busy(
    true,
    'Rejecting request…'
  );

  try {
    const out =
      await api(
        'rejectRequest',
        {
          requestId,
          reason:
            reason.trim()
        }
      );

    alert(out.message);

    await refreshApplication();

  } catch (err) {
    handleSessionError(err);
    alert(err.message);

  } finally {
    busy(false);
  }
}


async function refreshApplication() {
  await loadMyRequests();

  if (isAdmin()) {
    await loadAdmin();
  }
}


async function refreshMineUi() {
  busy(
    true,
    'Refreshing…'
  );

  try {
    await loadMyRequests();
  } catch (err) {
    handleSessionError(err);
    alert(err.message);
  } finally {
    busy(false);
  }
}


async function refreshAdminUi() {
  busy(
    true,
    'Refreshing admin requests…'
  );

  try {
    await loadAdmin();
  } catch (err) {
    handleSessionError(err);
    alert(err.message);
  } finally {
    busy(false);
  }
}


$('sendOtpBtn')
  .addEventListener(
    'click',
    sendOtp
  );

$('verifyOtpBtn')
  .addEventListener(
    'click',
    verifyOtp
  );

$('submitRequestBtn')
  .addEventListener(
    'click',
    submitRequest
  );

$('refreshMineBtn')
  .addEventListener(
    'click',
    refreshMineUi
  );

$('refreshAdminBtn')
  .addEventListener(
    'click',
    refreshAdminUi
  );

$('adminFilter')
  .addEventListener(
    'change',
    async () => {
      try {
        await loadAdmin();
      } catch (err) {
        handleSessionError(err);
        alert(err.message);
      }
    }
  );

$('logoutBtn')
  .addEventListener(
    'click',
    logoutUser
  );

$('otp')
  .addEventListener(
    'keydown',
    event => {
      if (event.key === 'Enter') {
        verifyOtp();
      }
    }
  );

restoreSession();
