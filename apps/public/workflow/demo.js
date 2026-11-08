// Demo only: the form validates locally and sends nothing.
const form = document.querySelector('form');
const status = form.querySelector('.status');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  status.textContent = form.checkValidity()
    ? 'Demo only. Nothing was sent.'
    : 'Please enter your name and a valid email.';
  if (!form.checkValidity()) form.reportValidity();
});
