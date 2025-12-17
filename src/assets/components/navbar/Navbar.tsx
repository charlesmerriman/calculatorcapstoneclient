import { useNavigate, Link } from 'react-router-dom';

export const Navbar = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('authToken')
        {/*TODO: Clear user from state/context*/}
        navigate('/login')
    }

    return (
        <nav className='flex'>
            {/*Left side*/}
            <div><Link to="/">Home</Link></div>
            {/*Right side*/}
            <div><button onClick={() => handleLogout()}>Logout</button></div>
        </nav>
    )
}

//TODO: Add styles
//TODO: Income user info dropdown menu