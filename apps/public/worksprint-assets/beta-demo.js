// Local-only prototype: no fetch, storage, analytics, account creation or provider integration.
// CSP also blocks connections and form actions, including when JavaScript is unavailable.
const form = document.querySelector('form');
const feedback = form.querySelector('.feedback');
const fields = [...form.querySelectorAll('input,textarea,select')];
form.noValidate = true;
form.querySelector('button').disabled = false;
function validate(field, trim = false) {
  if (trim && field.required) field.value = field.value.trim();
  let error = '';
  if (field.required && !field.value.trim()) error = field.name === 'name' ? 'Enter your name.' : 'Enter your email.';
  else if (field.type === 'email' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value) || field.validity.typeMismatch)) error = 'Enter a valid email, such as name@example.com.';
  else if (field.maxLength >= 0 && field.value.length > field.maxLength) error = `Use ${field.maxLength} characters or fewer.`;
  else if (field.tagName === 'SELECT' && !['', '1', '2-10', '11-50', '51-200', '201+'].includes(field.value)) error = 'Choose a listed team size or leave it blank.';
  document.getElementById(field.id + '-error').textContent = error;
  field.setAttribute('aria-invalid', String(Boolean(error)));
  return !error;
}
fields.forEach(field => {
  field.addEventListener('blur', () => validate(field, true));
  field.addEventListener('input', () => {
    feedback.textContent = '';
    if (field.getAttribute('aria-invalid') === 'true') validate(field);
  });
});
form.addEventListener('submit', event => {
  event.preventDefault();
  const invalid = fields.filter(field => !validate(field, true));
  if (invalid.length) {
    feedback.textContent = 'Check the highlighted fields. Nothing was sent.';
    invalid[0].focus();
    return;
  }
  feedback.textContent = 'Demo only — nothing was sent. Your draft remains here.';
});
document.querySelectorAll('[data-privacy]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  const note = document.getElementById('privacy');
  note.open = true;
  note.scrollIntoView({ block: 'center' });
  note.querySelector('summary').focus();
}));
