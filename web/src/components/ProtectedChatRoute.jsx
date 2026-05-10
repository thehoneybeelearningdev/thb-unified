import React, { useContext } from 'react';
import { FiLoader } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import Unauthorized from '../pages/Unauthorized';

const ProtectedChatRoute = ({ children }) => {
  const { currentUser, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin text-blue-600 mb-4">
          <FiLoader size={40} />
        </div>
        <p className="text-gray-600 text-lg font-medium">Verifying access...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Unauthorized message="This page is only accessible to logged-in users. Please log in to continue." />;
  }

  return children;
};

export default ProtectedChatRoute;
