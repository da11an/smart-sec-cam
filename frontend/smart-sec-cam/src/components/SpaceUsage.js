import React, { useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import SERVER_URL from '../config';

const SpaceUsage = () => {
    const [spaceInfo, setSpaceInfo] = useState(null);
    const [cookies] = useCookies(['token']);

    const formatSize = (bytes) => {
        if (!bytes && bytes !== 0) return '0 GB';
        const gb = bytes / (1024 * 1024 * 1024);
        return `${gb.toFixed(1)} GB`;
    };

    useEffect(() => {
        const checkSpaceUsage = async () => {
            try {
                const response = await fetch(`${SERVER_URL}/api/video/space-usage`, {
                    headers: {
                        'x-access-token': cookies.token
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('Space usage response:', data); // Debug log
                
                // Ensure we have valid numbers
                setSpaceInfo({
                    total_space: Number(data.total_space) || 0,
                    starred_space: Number(data.starred_space) || 0,
                    total_limit: Number(data.total_limit) || 0,
                    starred_limit: Number(data.starred_limit) || 0,
                    warnings: data.warnings || [],
                    removed_videos: data.removed_videos || []
                });

                // Show alerts if there are warnings
                if (data.warnings && data.warnings.length > 0) {
                    let warningMessage = data.warnings.join('\n');
                    if (data.removed_videos && data.removed_videos.length > 0) {
                        warningMessage += '\n\nRemoved videos:\n' + data.removed_videos.join('\n');
                    }
                    alert(warningMessage);
                }
            } catch (error) {
                console.error('Error checking space usage:', error);
            }
        };

        checkSpaceUsage();
        const interval = setInterval(checkSpaceUsage, 300000); // Check every 5 minutes

        return () => clearInterval(interval);
    }, [cookies.token]);

    if (!spaceInfo) return null;

    return (
        <div className="space-usage">
            <div className="usage-bar">
                <div className="total-usage">
                    <h4>Total Space</h4>
                    <div className="progress-bar">
                        <div 
                            className="progress" 
                            style={{
                                width: `${spaceInfo.total_limit ? (spaceInfo.total_space / spaceInfo.total_limit * 100) : 0}%`,
                                backgroundColor: spaceInfo.total_space > spaceInfo.total_limit * 0.9 ? '#ff4444' : '#44aa44'
                            }}
                        />
                    </div>
                    <span>{formatSize(spaceInfo.total_space)} / {formatSize(spaceInfo.total_limit)}</span>
                </div>
                <div className="starred-usage">
                    <h4>Starred Videos</h4>
                    <div className="progress-bar">
                        <div 
                            className="progress" 
                            style={{
                                width: `${spaceInfo.starred_limit ? (spaceInfo.starred_space / spaceInfo.starred_limit * 100) : 0}%`,
                                backgroundColor: spaceInfo.starred_space > spaceInfo.starred_limit * 0.9 ? '#ff4444' : '#44aa44'
                            }}
                        />
                    </div>
                    <span>{formatSize(spaceInfo.starred_space)} / {formatSize(spaceInfo.starred_limit)}</span>
                </div>
            </div>
        </div>
    );
};

export default SpaceUsage; 