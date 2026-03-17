import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomeScreen from './screens/HomeScreen';
import ProcessingScreen from './screens/ProcessingScreen';
import BatchProcessingScreen from './screens/BatchProcessingScreen';
import ResultsScreen from './screens/ResultsScreen';
import HistoryScreen from './screens/HistoryScreen';
import ReviewDetailsScreen from './screens/ReviewDetailsScreen';

export default function App() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/processing" element={<ProcessingScreen />} />
        <Route path="/batch-processing" element={<BatchProcessingScreen />} />
        <Route path="/results" element={<ResultsScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/review-details" element={<ReviewDetailsScreen />} />
      </Routes>
    </div>
  );
}
