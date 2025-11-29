import React from 'react';
import './AnalyticsModal.css';

function AnalyticsModal({ analytics, onClose, isOpen }) {
  if (!isOpen || !analytics) return null;

  const {
    totalBalloonsPopped,
    correctTargetHits,
    averageReactionTime,
    finalScore,
    accuracy,
    scoreComparison,
    accuracyComparison,
    reactionTimeComparison,
    suggestions,
    levelStats,
    previousSession
  } = analytics;

  const formatComparison = (value) => {
    if (value > 0) return `+${value}%`;
    if (value < 0) return `${value}%`;
    return '0%';
  };

  return (
    <div className="analytics-modal-overlay" onClick={onClose}>
      <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>
        <div className="analytics-modal-header">
          <h2>🎯 Performance Analytics</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="analytics-modal-content">
          {/* Overall Stats */}
          <div className="analytics-section">
            <h3>Overall Performance</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Final Score</div>
                <div className="stat-value">{finalScore}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Balloons Popped</div>
                <div className="stat-value">{totalBalloonsPopped}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Target Hits</div>
                <div className="stat-value">{correctTargetHits}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Accuracy</div>
                <div className="stat-value">{accuracy}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Avg Reaction Time</div>
                <div className="stat-value">{averageReactionTime}ms</div>
              </div>
            </div>
          </div>

          {/* Session Comparison */}
          {previousSession && (
            <div className="analytics-section">
              <h3>Session Comparison</h3>
              <div className="comparison-grid">
                <div className="comparison-item">
                  <span className="comparison-label">Score:</span>
                  <span className={`comparison-value ${scoreComparison >= 0 ? 'positive' : 'negative'}`}>
                    {formatComparison(scoreComparison)}
                  </span>
                </div>
                <div className="comparison-item">
                  <span className="comparison-label">Accuracy:</span>
                  <span className={`comparison-value ${accuracyComparison >= 0 ? 'positive' : 'negative'}`}>
                    {formatComparison(accuracyComparison)}%
                  </span>
                </div>
                <div className="comparison-item">
                  <span className="comparison-label">Reaction Time:</span>
                  <span className={`comparison-value ${reactionTimeComparison <= 0 ? 'positive' : 'negative'}`}>
                    {formatComparison(reactionTimeComparison)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          {suggestions && suggestions.length > 0 && (
            <div className="analytics-section">
              <h3>💡 AI Suggestions</h3>
              <ul className="suggestions-list">
                {suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Level Breakdown */}
          {levelStats && Object.keys(levelStats).length > 0 && (
            <div className="analytics-section">
              <h3>Level Breakdown</h3>
              <div className="level-stats-grid">
                {Object.entries(levelStats).map(([level, stats]) => (
                  <div key={level} className="level-stat-card">
                    <div className="level-number">Level {level}</div>
                    <div className="level-details">
                      <div>Score: {stats.score || 0}</div>
                      <div>Hits: {stats.hits || 0}/{stats.total || 0}</div>
                      {stats.timeUsed && <div>Time: {stats.timeUsed}s</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="analytics-modal-footer">
          <button className="close-modal-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsModal;

