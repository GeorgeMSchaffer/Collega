// Local-only state demonstration, not a provider request. Nothing is stored or transmitted.
const form = document.querySelector('form');
const feedback = form.querySelector('.feedback');
const button = form.querySelector('button');
const fields = [...form.querySelectorAll('input,textarea,select')];
let pending = false;
form.noValidate = true;
button.disabled = false;
function validate(field, trim = false) {
  if (trim && field.required) field.value = field.value.trim();
  let message = '';
  if (field.required && !field.value.trim()) message = field.name === 'name' ? 'Enter your name.' : 'Enter your email.';
  else if (field.type === 'email' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value) || field.validity.typeMismatch)) message = 'Enter a valid email, such as name@example.com.';
  else if (field.maxLength >= 0 && field.value.length > field.maxLength) message = `Use ${field.maxLength} characters or fewer.`;
  else if (field.tagName === 'SELECT' && !['', '1', '2-10', '11-50', '51-200', '201+'].includes(field.value)) message = 'Choose a listed team size or leave it blank.';
  document.getElementById(field.id + '-error').textContent = message;
  field.setAttribute('aria-invalid', String(Boolean(message)));
  return !message;
}
fields.forEach(field => {
  field.addEventListener('blur', () => { if (!pending) validate(field, true); });
  field.addEventListener('input', () => {
    if (!pending) feedback.textContent = '';
    if (field.getAttribute('aria-invalid') === 'true') validate(field);
  });
});
form.addEventListener('submit', event => {
  event.preventDefault();
  if (pending) return;
  const invalid = fields.filter(field => !validate(field, true));
  if (invalid.length) {
    feedback.textContent = 'Check the highlighted fields. Nothing was sent.';
    invalid[0].focus();
    return;
  }
  pending = true;
  form.setAttribute('aria-busy', 'true');
  // aria-disabled keeps the focused submit button reachable; the guard blocks repeat activation.
  button.setAttribute('aria-disabled', 'true');
  button.textContent = 'Checking locally…';
  feedback.textContent = 'Local demo check in progress. No request is being sent.';
  window.setTimeout(() => {
    pending = false;
    form.removeAttribute('aria-busy');
    button.removeAttribute('aria-disabled');
    button.textContent = 'Request beta access';
    feedback.textContent = 'Demo only — nothing was sent. Your draft remains here. No account or email was created.';
  }, 650);
});
document.querySelectorAll('[data-privacy]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  const note = document.getElementById('privacy');
  note.open = true;
  note.scrollIntoView({block:'center',behavior:'instant'});
  note.querySelector('summary').focus();
}));
