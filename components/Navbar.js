import Link from 'next/link'
import React from 'react'

const Navbar = ({name}) => {
  return (
    <div className='hidden md:flex w-auto gap-2  p-2 bg-[#464646] z-50 text-sm justify-center items-center'>
        {name} : <Link className='font-semibold' href="https://casework.justice-minds.com/">Case Works</Link>
    </div>
  )
}

export default Navbar