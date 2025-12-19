import React, { useState } from 'react';
import { userLogin } from '../../services/userServices'; 
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await userLogin({username, password});
      console.log('Login successful:', response);

    } catch (error) {
      setError('Invalid username or password');
    } finally {
      setIsLoading(false);
      navigate("/")
    }
  }

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleLoginSubmit}>

        <div>
          <label htmlFor='username'>Username:</label>
          <input
            type='text'
            id='username'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete='username' />
        </div>

        <div>
          <label htmlFor='password'>Password:</label>
          <input
            type='password'
            id='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete='current-password' />
        </div>

        {error && (
          <div className='text-red-500'>
            {error}
          </div>
        )}

        <button
        type='submit'
        disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Login'}
        </button>

      </form>
    </div>
  )
}