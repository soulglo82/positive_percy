import ParentDashboard from './pages/ParentDashboard';
import Rewards from './pages/Rewards';
import ChildView from './pages/ChildView';
import History from './pages/History';
import Summary from './pages/Summary';
import ParentProfile from './pages/ParentProfile';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ParentDashboard": ParentDashboard,
    "Rewards": Rewards,
    "ChildView": ChildView,
    "History": History,
    "Summary": Summary,
    "ParentProfile": ParentProfile,
}

export const pagesConfig = {
    mainPage: "ParentDashboard",
    Pages: PAGES,
    Layout: __Layout,
};
