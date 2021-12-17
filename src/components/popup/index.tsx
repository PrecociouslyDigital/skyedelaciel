import React from 'react';

const Popover: React.FC<{
    content: React.ReactChildren
}> = ({children, content}) => <div className="popup wrapper">
  <div className='popup title'>{children}</div>
  <div className="popup content">
    {content}
  </div>
</div>;