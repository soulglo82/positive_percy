import ParentDashboard from './pages/ParentDashboard';
import Rewards from './pages/Rewards';
import Children from './pages/Children';
import ChildView from './pages/ChildView';
import Activity from './pages/Activity';
import ParentProfile from './pages/ParentProfile';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ParentDashboard": ParentDashboard,
    "Rewards": Rewards,
    "Children": Children,
    "ChildView": ChildView,
    "Activity": Activity,
    "ParentProfile": ParentProfile,
}

export const pagesConfig = {
    mainPage: "ParentDashboard",
    Pages: PAGES,
    Layout: __Layout,
};
