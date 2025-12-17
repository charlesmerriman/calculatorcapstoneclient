import { useNavigate, Link } from 'react-router-dom';

export const Navbar = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('authToken')
        {/*TODO: Clear user from state/context*/}
        navigate('/login')
    }

    return (
        <nav className='flex justify-between'>
            {/*Left side*/}
            <div className='btn btn-ghost'><Link to="/">Home</Link></div>
            {/*Right side*/}
            <div className='btn btn-ghost'><button onClick={() => handleLogout()}>Logout</button></div>
        </nav>
    )
}

//TODO: Income user info dropdown menu