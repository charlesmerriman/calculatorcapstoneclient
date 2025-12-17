import './App.css'
import { Route, Routes } from 'react-router-dom'
import { ApplicationViews } from './views/ApplicationViews.js'

function App() {
  return (
    <Routes>
      <Route path='*' element={<ApplicationViews />}/>
    </Routes>
  )
}

export default App

//      <Route path='/login' element={} />
//      <Route path='/register' element={} />