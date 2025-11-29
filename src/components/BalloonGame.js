import React, { useState, useEffect, useRef } from 'react';
import { auth, db, realtimeDb } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, set, get } from 'firebase/database';
import AnalyticsModal from './AnalyticsModal';
import './BalloonGame.css';

const BALLOON_COLORS = ['red', 'blue', 'yellow', 'gray'];
const ROWS = 5;
const COLUMNS = 4;

function BalloonGame() {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0); // Total cumulative score
  const [levelScore, setLevelScore] = useState(0); // Current level's score (starts at 0 each level)
  const [levelScores, setLevelScores] = useState({});
  const [balloons, setBalloons] = useState([]);
  const [poppedBalloons, setPoppedBalloons] = useState(new Set());
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [lastPlayedDate, setLastPlayedDate] = useState(null);
  const [targetColor, setTargetColor] = useState(null);
  const [targetReached, setTargetReached] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const animationFrameRef = useRef(null);
  const colorChangeIntervalRef = useRef(null);
  const levelRef = useRef(1);
  const poppedBalloonsRef = useRef(new Set());
  const totalScoreRef = useRef(0);
  const audioContextRef = useRef(null);
  const containerRef = useRef(null);
  const analyticsRef = useRef({
    targetColorHits: 0,
    totalHits: 0,
    reactionTimes: [],
    levelStats: {},
    gameStartTime: null,
    levelStartTimes: {}
  });
  const previousSessionRef = useRef(null);

  useEffect(() => {
    loadUserData();
    // Initialize AudioContext for sound effects
    if (typeof window !== 'undefined' && window.AudioContext) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Check if mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (colorChangeIntervalRef.current) {
        clearInterval(colorChangeIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    levelRef.current = level;
    if (gameStarted && !gameOver) {
      // Reset level score to 0 for each new level
      setLevelScore(0);
      // Reset target reached status for new level
      setTargetReached(false);
      // Track level start time
      analyticsRef.current.levelStartTimes[level] = Date.now();
      // Initialize level stats
      if (!analyticsRef.current.levelStats[level]) {
        analyticsRef.current.levelStats[level] = {
          hits: 0,
          total: 0,
          targetHits: 0,
          startTime: Date.now()
        };
      }
      initializeBalloons();
      if (level >= 2) {
        startAnimation();
      }
      if (level >= 3) {
        startColorChanging();
      } else {
        stopColorChanging();
      }
    }
  }, [level, gameStarted]);


  const loadUserData = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setLastPlayedDate(data.lastPlayedDate);
          previousSessionRef.current = data.previousSession || null;
        }

        // Load previous session analytics from Realtime DB
        try {
          const prevSessionRef = ref(realtimeDb, `users/${user.uid}/previousSession`);
          const prevSessionSnapshot = await get(prevSessionRef);
          if (prevSessionSnapshot.exists()) {
            previousSessionRef.current = prevSessionSnapshot.val();
          }
        } catch (error) {
          console.error('Error loading previous session:', error);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }
  };

  const initializeBalloons = () => {
    // Use setTimeout to ensure container is rendered
    setTimeout(() => {
      // Get the actual container dimensions
      const container = containerRef.current || document.querySelector('.balloons-container');
      if (!container) {
        // Fallback if container not found
        const containerWidth = window.innerWidth - 100;
        const containerHeight = window.innerHeight - 300;
        initializeBalloonsWithDimensions(containerWidth, containerHeight);
        return;
      }
      
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      initializeBalloonsWithDimensions(containerWidth, containerHeight);
    }, 100);
  };

  const initializeBalloonsWithDimensions = (containerWidth, containerHeight) => {
    // Calculate spacing to center balloons within container
    const balloonSize = 60;
    const padding = 30;
    const availableWidth = containerWidth - (padding * 2);
    const availableHeight = containerHeight - (padding * 2);
    const spacingX = availableWidth / (COLUMNS + 1);
    const spacingY = availableHeight / (ROWS + 1);
    
    const newBalloons = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLUMNS; col++) {
        const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
        const id = `${row}-${col}`;
        // Position relative to container with padding, centered on balloon
        const baseX = padding + spacingX * (col + 1) - (balloonSize / 2);
        const baseY = padding + spacingY * (row + 1) - (balloonSize / 2);
        
        const speed = 0.5 + (levelRef.current - 1) * 0.3;
        const directions = ['LR', 'RL', 'TB', 'BT'];
        
        newBalloons.push({
          id,
          row,
          col,
          color,
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          vx: levelRef.current >= 2 ? (Math.random() > 0.5 ? 1 : -1) * speed : 0,
          vy: levelRef.current >= 2 ? (Math.random() > 0.5 ? 1 : -1) * speed : 0,
          direction: levelRef.current >= 2 ? directions[Math.floor(Math.random() * directions.length)] : null,
        });
      }
    }
    setBalloons(newBalloons);
    setPoppedBalloons(new Set());
    poppedBalloonsRef.current = new Set();
    
    // Set target color for level 3+
    if (levelRef.current >= 3) {
      setTargetColor(BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)]);
    } else {
      setTargetColor(null);
    }
  };

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setLevelScore(0);
    totalScoreRef.current = 0;
    setLevel(1);
    setLevelScores({});
    setShowAnalytics(false);
    levelRef.current = 1;
    // Reset analytics
    analyticsRef.current = {
      targetColorHits: 0,
      totalHits: 0,
      reactionTimes: [],
      levelStats: {},
      gameStartTime: Date.now(),
      levelStartTimes: {}
    };
    initializeBalloons();
  };

  const startAnimation = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    const animate = () => {
      if (levelRef.current >= 2 && gameStarted && !gameOver) {
        setBalloons(prevBalloons => {
          return prevBalloons.map(balloon => {
            if (poppedBalloonsRef.current.has(balloon.id)) return balloon;
            
            let newX = balloon.x;
            let newY = balloon.y;
            let newVx = balloon.vx;
            let newVy = balloon.vy;
            const containerWidth = window.innerWidth;
            const containerHeight = window.innerHeight - 200;

            // Get container bounds for collision detection
            const container = containerRef.current || document.querySelector('.balloons-container');
            const containerPadding = 30;
            const balloonSize = 60;
            let minX = containerPadding;
            let maxX = window.innerWidth - 100;
            let minY = containerPadding;
            let maxY = window.innerHeight - 300;
            
            if (container) {
              const containerWidth = container.clientWidth;
              const containerHeight = container.clientHeight;
              maxX = containerWidth - containerPadding - balloonSize;
              maxY = containerHeight - containerPadding - balloonSize;
            }

            if (balloon.direction === 'LR') {
              newX += balloon.vx;
              if (newX >= maxX || newX <= minX) {
                newVx = -newVx;
              }
            } else if (balloon.direction === 'RL') {
              newX -= balloon.vx;
              if (newX >= maxX || newX <= minX) {
                newVx = -newVx;
              }
            } else if (balloon.direction === 'TB') {
              newY += balloon.vy;
              if (newY >= maxY || newY <= minY) {
                newVy = -newVy;
              }
            } else if (balloon.direction === 'BT') {
              newY -= balloon.vy;
              if (newY >= maxY || newY <= minY) {
                newVy = -newVy;
              }
            }

            return {
              ...balloon,
              x: newX,
              y: newY,
              vx: newVx,
              vy: newVy
            };
          });
        });
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animate();
  };

  const startColorChanging = () => {
    if (colorChangeIntervalRef.current) {
      clearInterval(colorChangeIntervalRef.current);
    }
    
    const colorChangeSpeed = Math.max(500 - (levelRef.current - 3) * 50, 200);
    
    colorChangeIntervalRef.current = setInterval(() => {
      setBalloons(prevBalloons => {
        return prevBalloons.map(balloon => {
          if (poppedBalloonsRef.current.has(balloon.id)) return balloon;
          const newColor = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
          return { ...balloon, color: newColor };
        });
      });
    }, colorChangeSpeed);
  };

  const stopColorChanging = () => {
    if (colorChangeIntervalRef.current) {
      clearInterval(colorChangeIntervalRef.current);
      colorChangeIntervalRef.current = null;
    }
  };

  const playBoomSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      
      // Resume audio context if suspended (required for user interaction)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Create oscillator for boom sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configure boom sound (low frequency with quick decay)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.1);
      
      // Envelope for boom effect
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      // Play sound
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('Could not play sound:', error);
    }
  };

  const handleBalloonHover = (balloonId, balloonColor) => {
    if (poppedBalloons.has(balloonId) || !gameStarted || gameOver) return;

    // Track reaction time
    const levelStartTime = analyticsRef.current.levelStartTimes[level] || Date.now();
    const reactionTime = Date.now() - levelStartTime;
    analyticsRef.current.reactionTimes.push(reactionTime);

    // Level 3+: Only pop target color
    if (level >= 3 && balloonColor !== targetColor) {
      return;
    }

    // Track target color hits (for level 3+)
    if (level >= 3 && balloonColor === targetColor) {
      analyticsRef.current.targetColorHits++;
    }

    // Track level stats
    if (analyticsRef.current.levelStats[level]) {
      analyticsRef.current.levelStats[level].hits++;
      analyticsRef.current.levelStats[level].total++;
      if (level >= 3 && balloonColor === targetColor) {
        analyticsRef.current.levelStats[level].targetHits++;
      }
    }

    analyticsRef.current.totalHits++;

    // Play boom sound when balloon is popped
    playBoomSound();

    setPoppedBalloons(prev => {
      const newSet = new Set(prev);
      newSet.add(balloonId);
      poppedBalloonsRef.current = newSet;
      return newSet;
    });

    // Update level score (starts at 0 each level)
    setLevelScore(prev => {
      const newLevelScore = prev + 10;
      
      // Update total cumulative score
      setScore(prevTotal => {
        const newTotal = prevTotal + 10;
        totalScoreRef.current = newTotal;
        return newTotal;
      });
      
      // Check if target score is reached
      checkTargetScore(newLevelScore, level);
      
      return newLevelScore;
    });

    // Check if all balloons are popped after state update
    setTimeout(() => {
      setPoppedBalloons(prev => {
        if (prev.size === ROWS * COLUMNS) {
          setLevelScore(currentLevelScore => {
            const targetScore = getTargetScore(level);
            
            // Check if target is reached before allowing progression
            if (currentLevelScore >= targetScore) {
              // Save level score to Realtime Database
              saveLevelScore(level, currentLevelScore);
              
              // Update level scores state
              setLevelScores(prevScores => {
                const updatedScores = {
                  ...prevScores,
                  [level]: currentLevelScore
                };
                
                // Update level completion time and score
                if (analyticsRef.current.levelStats[level]) {
                  const levelStartTime = analyticsRef.current.levelStartTimes[level] || Date.now();
                  analyticsRef.current.levelStats[level].timeUsed = Math.floor((Date.now() - levelStartTime) / 1000);
                  analyticsRef.current.levelStats[level].score = currentLevelScore;
                }

                // Level complete
                if (level < 10) {
                  const nextLevel = level + 1;
                  setLevel(nextLevel);
                  setPoppedBalloons(new Set());
                  poppedBalloonsRef.current = new Set();
                } else {
                  // Game complete - pass updated scores
                  endGame(totalScoreRef.current, updatedScores);
                }
                
                return updatedScores;
              });
            }
            return currentLevelScore;
          });
        }
        return prev;
      });
    }, 100);
  };

  const saveLevelScore = async (levelNum, levelScore) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const userScoresRef = ref(realtimeDb, `users/${user.uid}/levels/level${levelNum}`);
        await set(userScoresRef, {
          level: levelNum,
          score: levelScore,
          timestamp: new Date().toISOString()
        });
        console.log(`Level ${levelNum} score saved: ${levelScore}`);
      } catch (error) {
        console.error(`Error saving level ${levelNum} score:`, error);
      }
    }
  };

  const saveFinalScore = async (finalScore = null, scoresToSave = null) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const scoreToSave = finalScore !== null ? finalScore : totalScoreRef.current;
        const levelScoresToSave = scoresToSave || levelScores;
        
        // Save final score to Realtime Database
        const finalScoreRef = ref(realtimeDb, `users/${user.uid}/finalScore`);
        await set(finalScoreRef, {
          finalScore: scoreToSave,
          levelScores: levelScoresToSave,
          totalLevels: 10,
          timestamp: new Date().toISOString()
        });
        console.log('Final score saved:', scoreToSave);
      } catch (error) {
        console.error('Error saving final score:', error);
      }
    }
  };

  const calculateAnalytics = () => {
    const analytics = analyticsRef.current;
    const reactionTimes = analytics.reactionTimes;
    const averageReactionTime = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;

    // Calculate accuracy (for level 3+)
    const accuracy = analytics.totalHits > 0
      ? Math.round((analytics.targetColorHits / analytics.totalHits) * 100)
      : 100;

    // Generate AI suggestions
    const suggestions = generateAISuggestions(analytics, averageReactionTime, accuracy);

    // Compare with previous session
    let scoreComparison = 0;
    let accuracyComparison = 0;
    let reactionTimeComparison = 0;

    if (previousSessionRef.current) {
      const prev = previousSessionRef.current;
      const currentScore = totalScoreRef.current;
      const prevScore = prev.finalScore || 0;
      scoreComparison = prevScore > 0
        ? Math.round(((currentScore - prevScore) / prevScore) * 100)
        : 100;

      const prevAccuracy = prev.accuracy || 100;
      accuracyComparison = Math.round(accuracy - prevAccuracy);

      const prevReactionTime = prev.averageReactionTime || 0;
      reactionTimeComparison = prevReactionTime > 0
        ? Math.round(((averageReactionTime - prevReactionTime) / prevReactionTime) * 100)
        : 0;
    }

    return {
      totalBalloonsPopped: analytics.totalHits,
      correctTargetHits: analytics.targetColorHits,
      averageReactionTime,
      finalScore: totalScoreRef.current,
      accuracy,
      scoreComparison,
      accuracyComparison,
      reactionTimeComparison,
      suggestions,
      levelStats: analytics.levelStats,
      previousSession: previousSessionRef.current
    };
  };

  const generateAISuggestions = (analytics, avgReactionTime, accuracy) => {
    const suggestions = [];

    // Reaction time suggestions
    if (avgReactionTime > 2000) {
      suggestions.push("Your reaction time is a bit slow. Try to focus more and react faster to improve your score!");
    } else if (avgReactionTime < 800) {
      suggestions.push("Excellent reaction time! You're very quick at spotting and popping balloons.");
    }

    // Accuracy suggestions (for level 3+)
    const hasLevel3Plus = Object.keys(analytics.levelStats).some(l => parseInt(l) >= 3);
    if (analytics.totalHits > 0 && hasLevel3Plus) {
      const accuracyPercent = (analytics.targetColorHits / analytics.totalHits) * 100;
      if (accuracyPercent < 70) {
        suggestions.push("Try to focus more on the target color balloons. Pay attention to the color indicator at the top!");
      } else if (accuracyPercent > 90) {
        suggestions.push("Great accuracy! You're excellent at identifying the correct target color.");
      }
    }

    // Level performance suggestions
    const levelStats = analytics.levelStats;
    const slowLevels = Object.entries(levelStats)
      .filter(([_, stats]) => stats.timeUsed > 15)
      .map(([level, _]) => level);

    if (slowLevels.length > 0) {
      suggestions.push(`Levels ${slowLevels.join(', ')} took longer. Try to be more efficient in these levels next time!`);
    }

    // Score improvement suggestions
    if (totalScoreRef.current < 500) {
      suggestions.push("Try to pop balloons faster to increase your score. Speed is key!");
    } else if (totalScoreRef.current > 1500) {
      suggestions.push("Outstanding performance! You're mastering the game. Keep up the excellent work!");
    }

    // General encouragement
    if (suggestions.length === 0) {
      suggestions.push("Great job! Keep practicing to improve your skills even further.");
    }

    // Area-based suggestion (random for now, could be enhanced with actual position tracking)
    const areas = ['upper-left', 'upper-right', 'lower-left', 'lower-right', 'center'];
    const randomArea = areas[Math.floor(Math.random() * areas.length)];
    suggestions.push(`Try focusing more on the ${randomArea} area next time for better coverage.`);

    return suggestions;
  };

  const endGame = async (finalScore = null, finalLevelScores = null) => {
    setGameOver(true);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    stopColorChanging();

    // Calculate analytics
    const analytics = calculateAnalytics();
    setAnalyticsData(analytics);

    const user = auth.currentUser;
    if (user) {
      try {
        const scoreToSave = finalScore !== null ? finalScore : totalScoreRef.current;
        
        // Save final score to Realtime Database
        await saveFinalScore(scoreToSave, finalLevelScores);
        
        // Save analytics to Realtime Database
        const analyticsRef_db = ref(realtimeDb, `users/${user.uid}/analytics`);
        await set(analyticsRef_db, {
          ...analytics,
          timestamp: new Date().toISOString()
        });

        // Save as previous session for next time
        const prevSessionRef = ref(realtimeDb, `users/${user.uid}/previousSession`);
        await set(prevSessionRef, {
          finalScore: scoreToSave,
          accuracy: analytics.accuracy,
          averageReactionTime: analytics.averageReactionTime,
          totalBalloonsPopped: analytics.totalBalloonsPopped,
          timestamp: new Date().toISOString()
        });
        
        // Also save to Firestore for backward compatibility
        const userDocRef = doc(db, 'users', user.uid);
        const currentDate = new Date().toISOString();
        await setDoc(userDocRef, {
          name: user.displayName || user.email,
          email: user.email,
          score: scoreToSave,
          level: level,
          lastPlayedDate: currentDate,
          previousSession: {
            finalScore: scoreToSave,
            accuracy: analytics.accuracy,
            averageReactionTime: analytics.averageReactionTime
          }
        }, { merge: true });
        setLastPlayedDate(currentDate);
        
        // Show analytics modal after a short delay
        setTimeout(() => {
          setShowAnalytics(true);
        }, 500);
      } catch (error) {
        console.error('Error saving user data:', error);
        // Still show analytics even if save fails
        setTimeout(() => {
          setShowAnalytics(true);
        }, 500);
      }
    } else {
      // Show analytics even if not logged in
      setTimeout(() => {
        setShowAnalytics(true);
      }, 500);
    }
  };

  const getTargetScore = (levelNum) => {
    // Level 1: 30, Level 2: 40, Level 3: 50, etc.
    return 30 + (levelNum - 1) * 10;
  };

  const checkTargetScore = (currentLevelScore, currentLevel) => {
    const targetScore = getTargetScore(currentLevel);
    
    // Check if target is reached
    if (currentLevelScore >= targetScore) {
      if (!targetReached) {
        setTargetReached(true);
      }
      // Allow progression to next level (but player can continue scoring)
      // We'll handle progression when all balloons are popped
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="balloon-game-container">
      <div className="game-header">
        <div className="game-info">
          <div className="info-item">
            <span className="label">Level:</span>
            <span className="value">{level}/10</span>
          </div>
          <div className="info-item">
            <span className="label">Score:</span>
            <span className="value">{levelScore}</span>
          </div>
          <div className="info-item">
            <span className="label">Total:</span>
            <span className="value">{score}</span>
          </div>
          <div className="info-item">
            <span className="label">Target:</span>
            <span className={`value ${targetReached ? 'target-reached' : ''}`}>
              {getTargetScore(level)}
            </span>
          </div>
          {targetColor && (
            <div className="info-item target-color">
              <span className="label">Target:</span>
              <span className={`value color-${targetColor}`}>{targetColor}</span>
            </div>
          )}
        </div>
        {lastPlayedDate && (
          <div className="last-played">
            Last played: {formatDate(lastPlayedDate)}
          </div>
        )}
      </div>

      {!gameStarted ? (
        <div className="game-start-screen">
          <h2>Balloon Popping Game</h2>
          <p className="instructions">
            {isMobile 
              ? 'POP THE BALLOONS BY TAPPING ON THEM' 
              : 'POP THE BALLOONS BY MOVING YOUR MOUSE OVER THEM'}
          </p>
          {lastPlayedDate && (
            <p className="last-played-info">You last played on: {formatDate(lastPlayedDate)}</p>
          )}
          <button onClick={startGame} className="start-button">Start Game</button>
        </div>
      ) : gameOver ? (
        <div className="game-over-screen">
          <h2>Game Complete! 🎉</h2>
          <p>Final Total Score: {score}</p>
          <p>Levels Completed: {level}/10</p>
          <button onClick={startGame} className="start-button">Play Again</button>
        </div>
      ) : (
        <>
          <p className="game-instructions">
            {isMobile 
              ? 'POP THE BALLOONS BY TAPPING ON THEM' 
              : 'POP THE BALLOONS BY MOVING YOUR MOUSE OVER THEM'}
          </p>
          <div className="balloons-container" ref={containerRef}>
            {balloons.map(balloon => (
              <div
                key={balloon.id}
                className={`balloon ${balloon.color} ${poppedBalloons.has(balloon.id) ? 'popped' : ''}`}
                style={{
                  left: `${balloon.x}px`,
                  top: `${balloon.y}px`,
                  position: 'absolute'
                }}
                onMouseEnter={() => handleBalloonHover(balloon.id, balloon.color)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleBalloonHover(balloon.id, balloon.color);
                }}
              >
                {poppedBalloons.has(balloon.id) && (
                  <span className="pop-text">POP!</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      
      {showAnalytics && analyticsData && (
        <AnalyticsModal
          analytics={analyticsData}
          onClose={() => setShowAnalytics(false)}
          isOpen={showAnalytics}
        />
      )}
    </div>
  );
}

export default BalloonGame;

