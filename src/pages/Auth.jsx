import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { SheetHead } from '../components/Layout';
import { Field, Submit, useSubmit } from '../components/ui';
import { api, session } from '../lib/api';
import { toast } from '../lib/toast';

function Panel({ title, lede, children }) {
  return (
    <>
      <SheetHead title={title}>{lede && <p>{lede}</p>}</SheetHead>
      <section className="wrap py-12 md:py-16"><div className="max-w-md grid gap-6">{children}</div></section>
    </>
  );
}

function useFields(init) {
  const [f, setF] = useState(init);
  return [f, (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value })), () => setF(init)];
}

function Login() {
  const navigate = useNavigate();
  const [f, set] = useFields({ email: '', password: '' });
  const [submit, busy] = useSubmit(async () => {
    const res = await api('/auth/signin', { method: 'POST', body: f });
    session.set({ token: res.authToken });
    navigate('/Data');
  });
  return (
    <Panel title="Login">
      <form onSubmit={submit} className="grid gap-5">
        <Field label="Email" name="email" type="email" required autoComplete="username" value={f.email} onChange={set('email')} />
        <Field label="Password" name="password" type="password" required autoComplete="current-password" value={f.password} onChange={set('password')} />
        <Link to="/resetPassword" className="text-sm justify-self-start hover:text-signal">Forgot Password ?</Link>
        <Submit busy={busy}>Sign in</Submit>
      </form>
      <p className="text-ink-2">No account yet? <Link to="/signup" className="text-signal">Sign Up</Link></p>
    </Panel>
  );
}

function Signup() {
  const [f, set, reset] = useFields({ name: '', email: '', password: '' });
  const [submit, busy] = useSubmit(async () => {
    const res = await api('/auth/signup', { method: 'POST', body: f });
    reset();
    return { msg: res?.msg || 'Signed up successfully!' };
  });
  return (
    <Panel title="Signup">
      <form onSubmit={submit} className="grid gap-5">
        <Field label="Username" name="name" required autoComplete="nickname" value={f.name} onChange={set('name')} />
        <Field label="Email" name="email" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
        <Field label="Password" name="password" type="password" required autoComplete="new-password" value={f.password} onChange={set('password')} />
        <Submit busy={busy}>Sign Up</Submit>
      </form>
      <p className="text-ink-2">Already registered? <Link to="/login" className="text-signal">Login</Link></p>
    </Panel>
  );
}

function ResetPassword() {
  const navigate = useNavigate();
  const [f, set, reset] = useFields({ userEmail: '', newPassword: '' });
  const [submit, busy] = useSubmit(async () => {
    try {
      const res = await api('/auth/loginpasswordreset', { method: 'POST', body: f });
      navigate('/verifyUser');
      return res;
    } catch (e) { reset(); throw e; }
  });
  return (
    <Panel title="Reset Password" lede="You’ll use this password to sign in, and recover your account.">
      <form onSubmit={submit} className="grid gap-5">
        <Field label="Registered email" name="userEmail" type="email" required autoComplete="email" value={f.userEmail} onChange={set('userEmail')} />
        <Field label="New password" name="newPassword" type="password" required autoComplete="new-password" value={f.newPassword} onChange={set('newPassword')} />
        <p className="text-sm text-ink-2">A verification code will be sent to your registered email to reset your password.</p>
        <Submit busy={busy}>Reset</Submit>
      </form>
    </Panel>
  );
}

// 6-digit code form, shared by password reset (public) and email/password change (signed in).
export function Otp({ onVerify }) {
  const [code, setCode] = useState('');
  const [submit, busy] = useSubmit(() => onVerify(code));
  return (
    <form onSubmit={submit} className="grid gap-5">
      <p role="status" className="border border-ink px-4 py-3">OTP has been sent successfully!</p>
      <Field label="Enter the 6-digit code sent to your email" name="otp" required inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} pattern="\d{6}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        className="[&_.input]:data [&_.input]:text-2xl [&_.input]:tracking-[0.4em]" />
      <Submit busy={busy}>Verify OTP</Submit>
    </form>
  );
}

function VerifyUser() {
  const navigate = useNavigate();
  return (
    <Panel title="OTP Verification">
      <Otp onVerify={async (userotp) => {
        const res = await api('/auth/resetpassword', { method: 'PUT', body: { userotp } });
        toast.success('Now you can login with new password.');
        navigate('/login');
        return res;
      }} />
    </Panel>
  );
}

const VIEWS = { login: Login, signup: Signup, reset: ResetPassword, verifyUser: VerifyUser };
export default function Auth({ view }) {
  const View = VIEWS[view];
  return <View />;
}
