import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { BuilderPage } from './pages/BuilderPage';
import { SavedBuildsPage } from './pages/SavedBuildsPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/builder',
    element: <BuilderPage />,
  },
  {
    path: '/builds',
    element: <SavedBuildsPage />,
  },
  {
    path: '/build/:buildId',
    element: <div className="p-8">Build Details</div>,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;