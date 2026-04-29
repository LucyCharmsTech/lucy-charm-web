import React from 'react';

const Footer = () => {
  return (
    <footer className="w-full bg-white  border-t border-gray-200 py-6 mt-auto">
      <div className="max-w-7xl mx-auto text-center text-gray-700 ">
        © {new Date().getFullYear()} Lucy Charms Realty. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
