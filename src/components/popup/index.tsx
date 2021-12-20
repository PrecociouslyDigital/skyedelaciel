import React from 'react';
import './popup.scss';

export const Popup: React.FC<{
    content: React.ReactNode
}> = ({children, content}) => {
  if(content == null){
    return <>{children}</>;
  }
  return <div className="popup pwrapper">
    <div className="popup pcontent">
      {content}
    </div>
    <div className='popup ptitle'>{children}</div>
    
  </div>;
}