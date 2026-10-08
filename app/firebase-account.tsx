'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,GoogleAuthProvider,signInWithPopup,sendPasswordResetEmail,type User} from 'firebase/auth';
import {auth} from '@/lib/firebase';
import Tracker from './tracker';

function authError(error:unknown){
 const code=(error as {code?:string}).code;
 const messages:Record<string,string>={
  'auth/invalid-credential':'Email or password is incorrect.',
  'auth/email-already-in-use':'This email already has an account. Sign in instead.',
  'auth/weak-password':'Choose a password with at least 6 characters.',
  'auth/invalid-email':'Enter a valid email address.',
  'auth/unauthorized-domain':'This app domain must be added to Firebase Authentication’s authorized domains.',
  'auth/popup-blocked':'Your browser blocked Google sign-in. Allow the sign-in popup and try again.',
  'auth/operation-not-allowed':'Enable this sign-in method in Firebase Authentication.',
  'auth/account-exists-with-different-credential':'Sign in using the method already associated with this email.',
  'auth/too-many-requests':'Too many attempts. Please wait a little and try again.',
  'auth/network-request-failed':'Check your connection and try again.',
 };
 return messages[code??'']??'Unable to sign in. Please try again.';
}
export default function FirebaseAccount(){
 const[user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[mode,setMode]=useState<'signin'|'signup'|'reset'>('signin'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setReady(true);setPassword('');setError('');}),[]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{
  if(mode==='reset'){await sendPasswordResetEmail(auth,email.trim());setNotice('If this email has an account, a password reset link has been sent.');}
  else if(mode==='signup')await createUserWithEmailAndPassword(auth,email.trim(),password);
  else await signInWithEmailAndPassword(auth,email.trim(),password);
 }catch(e){setError(authError(e));}finally{setBusy(false);}}
 async function google(){setBusy(true);setError('');try{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,provider);}catch(e){if((e as {code?:string}).code!=='auth/popup-closed-by-user')setError(authError(e));}finally{setBusy(false);}}
 function change(next:typeof mode){setMode(next);setError('');setNotice('');setPassword('');}
 if(!ready)return <main className="auth-shell"><p role="status">Loading your account…</p></main>;
 if(user)return <Tracker key={user.uid}/>;
 return <main className="auth-shell"><section className="auth-panel"><div className="auth-brand">Since</div><h1>{mode==='signup'?'Create your account':mode==='reset'?'Reset your password':'Welcome back'}</h1><p className="auth-caption">Your timers and workspaces, synced across devices.</p>
 {mode!=='reset'&&<><button className="google-button" onClick={google} disabled={busy}>Continue with Google</button><div className="auth-divider">or use email</div></>}
 <form className="form-grid" onSubmit={submit}>{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="auth-notice" role="status">{notice}</p>}<label className="form-field">Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>{mode!=='reset'&&<label className="form-field">Password<input type="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?6:undefined} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>}<button type="submit" className="primary-button" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create account':mode==='reset'?'Send reset link':'Sign in'}</button></form>
 <div className="auth-links">{mode==='signin'?<><button onClick={()=>change('reset')} disabled={busy}>Forgot password?</button><button onClick={()=>change('signup')} disabled={busy}>Create an account</button></>:<button onClick={()=>change('signin')} disabled={busy}>Back to sign in</button>}</div></section></main>;
}
