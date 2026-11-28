import React from 'react';
import { Link } from 'react-router-dom';
import { Tractor, ArrowLeft, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-earth-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-700 shadow-soft">
          <Tractor className="w-10 h-10 animate-bounce" />
        </div>
        <h1 className="text-4xl font-display font-extrabold text-earth-900 tracking-tight sm:text-5xl">
          404
        </h1>
        <h2 className="text-xl font-bold text-earth-800 mt-2">
          Plot Not Found
        </h2>
        <p className="text-earth-600 text-sm mt-2 mb-8">
          The field or machine page you are looking for has moved or does not exist.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/">
            <Button variant="primary">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Return Home
            </Button>
          </Link>
          <Link to="/search">
            <Button variant="outline">
              <Search className="w-4 h-4 mr-1.5" />
              Browse Machinery
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
