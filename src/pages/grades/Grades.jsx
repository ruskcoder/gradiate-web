import React from 'react'
import { useLocation } from 'react-router-dom'
import { GradesLayout } from './GradesLayout'
import { GradesView } from './GradesView'
import { WhatIf } from '@/pages/calculators/WhatIf'
import { History } from '@/pages/statistics/History'
import { TimelinePage } from '@/pages/statistics/Timeline'
import { ImpactsPage } from '@/pages/statistics/Impacts'

export default function Grades() {
  const location = useLocation();
  
  let element = null;
  let pageTitle = 'Grades';

  switch (location.pathname) {
    case '/grades/whatif':
      element = <WhatIf />;
      pageTitle = 'What If';
      break;
    case '/statistics/history':
      element = <History />;
      pageTitle = 'History';
      break;
    case '/statistics/timeline':
      element = <TimelinePage />;
      pageTitle = 'Timeline';
      break;
    case '/statistics/timetravel':
      element = <GradesView timeTravel={true} />;
      pageTitle = 'TimeTravel';
      break;
    case '/statistics/impacts':
      element = <ImpactsPage />;
      pageTitle = 'Impacts';
      break;
    default:
      element = <GradesView />;
      pageTitle = 'Grades';
  }

  return <GradesLayout pageTitle={pageTitle} element={element} />
}