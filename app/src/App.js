import React, { Component } from 'react';
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom';

import Home from './component/Home';
import PortalLogin from './component/Auth/PortalLogin';

import Voting from './component/Voting/Voting';
import Outcomes from './component/Outcomes/Outcomes';
import FinalOutcomes from './component/Final_Outcomes/Final_Outcomes';
import Registration from './component/Registration/Registration';

import AddNews from './component/Admin/AddNews/AddNews';
import Verification from './component/Admin/Verification/Verification';
import test from './component/test';

import './App.css';

export default class App extends Component {
  render() {
    return (
      <div className="App">
        <Router>
          <Switch>
            <Route exact path="/" component={Home} />
            <Route exact path="/Login" component={PortalLogin} />
            <Route exact path="/AddNews" component={AddNews} />
            <Route exact path="/Voting" component={Voting} />
            <Route exact path="/Outcomes" component={Outcomes} />
            <Route exact path="/Final_Outcomes" component={FinalOutcomes} />
            <Route exact path="/Registration" component={Registration} />
            <Route exact path="/Verification" component={Verification} />
            <Route exact path="/test" component={test} />
            <Route exact path="*" component={NotFound} />
          </Switch>
        </Router>
      </div>
    );
  }
}

class NotFound extends Component {
  render() {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <h1 className="text-4xl font-extrabold text-rose-400">404 NOT FOUND</h1>
        <p className="text-slate-400 text-sm">
          The page you are looking for does not exist.
        </p>
        <Link
          to="/"
          className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-6 rounded-xl transition-colors text-xs"
        >
          Return to FactVerify Gateway &rarr;
        </Link>
      </div>
    );
  }
}
