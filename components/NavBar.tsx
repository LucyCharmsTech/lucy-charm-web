import Link from 'next/link';
import React from 'react';

const NavBar = () => {
  return (
    <div className="flex justify-between items-center p-4 bg-white  max-w-4xl mx-auto">
      <div className="flex flex-col items-center">
        <p className="text-2xl font-bold text-primarycolor">Lucycharms</p>
        <p className="text-xs text-gray-500">REALTY. BROKERAGE</p>
      </div>
      <div className="flex gap-6 text-gray-500 ">
        <Link href="/">Home</Link>
        <Link href="/listings">Buy</Link>
        <Link href="/sell">Sell</Link>
      </div>
      <div className=" font-semibold bg-primarycolor text-white px-4 py-2 rounded-full hover:bg-primarycolor/80 transition-all duration-300">
        <Link href="/contact">Contact Us</Link>
      </div>
    </div>
  );
};

export default NavBar;
