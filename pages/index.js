import { Button } from '@/components/ui/button'
import Link from 'next/link'
import React from 'react'

const index = () => {
  return (
    <div className='flex flex-col justify-center items-center w-full h-screen'>
    <img src="/logomain.png" className='md:w-1/3 w-1/2' alt="" />
    <div className="flex flex-row gap-3">
      <Button asChild>
        <Link href="/rooms">Rooms</Link>
      </Button>
      <Button asChild>
        <Link href="/canvas">Canvas Pages</Link>
      </Button>
      <Button asChild>
        <Link href="mailto:justice@justice-minds.com">Contact Us</Link>      
      </Button>
    </div>
    </div>
  )
}

export default index
