import React from 'react';
import { createRoot } from 'react-dom/client';
import HotlineAIAgentV3 from './hotline_ai_agent_v3.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HotlineAIAgentV3 />
  </React.StrictMode>
);
