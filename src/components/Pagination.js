import React from 'react';
import PropTypes from 'prop-types';

const Pagination = ({ nftsPerPage, totalNfts, paginate, currentPage }) => {
  const pageNumbers = [];
  for (let i = 1; i <= Math.ceil(totalNfts / nftsPerPage); i++) {
    pageNumbers.push(i);
  }

  const renderPageNumbers = () => {
    return pageNumbers.map((number, index) => {
      if (
        number === currentPage ||
        number === 1 ||
        number === pageNumbers.length ||
        (number >= currentPage - 2 && number <= currentPage + 2)
      ) {
        return (
          <li key={number} className={`page-item ${currentPage === number ? 'active' : ''}`}>
            <a onClick={() => paginate(number)} href="!#" className="page-link">
              {number}
            </a>
          </li>
        );
      } else if (
        (index === 1 && currentPage > 4) ||
        (index === pageNumbers.length - 2 && currentPage < pageNumbers.length - 3)
      ) {
        return <li key={number} className="page-item">...</li>;
      }
      return null;
    });
  };

  return (
    <nav className="pagination-container">
      <ul className="pagination">
        {currentPage !== 1 && pageNumbers.length > 1 && (
          <li className="page-item">
            <a onClick={() => paginate(currentPage - 1)} href="!#" className="page-link">
              Previous
            </a>
          </li>
        )}
        {renderPageNumbers()}
        {currentPage !== pageNumbers.length && pageNumbers.length > 1 && (
          <li className="page-item">
            <a onClick={() => paginate(currentPage + 1)} href="!#" className="page-link">
              Next
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
};

Pagination.propTypes = {
  nftsPerPage: PropTypes.number.isRequired,
  totalNfts: PropTypes.number.isRequired,
  paginate: PropTypes.func.isRequired,
  currentPage: PropTypes.number.isRequired,
};

export default Pagination;
