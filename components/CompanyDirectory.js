import React, { useState, useEffect } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import Papa from 'papaparse';

const CompanyDirectory = ({ csvData }) => {
  const [companies, setCompanies] = useState({});
  const [expandedCompanies, setExpandedCompanies] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (csvData) {
      parseCSVData(csvData);
    } else {
      // If no CSV data is provided, attempt to fetch it
      fetch('/mailsuite_tracks_1747994159.csv')
        .then((response) => response.text())
        .then((data) => parseCSVData(data))
        .catch((error) => console.error("Error loading CSV:", error))
        .finally(() => setLoading(false));
    }
  }, [csvData]);

  const parseCSVData = (data) => {
    try {
      Papa.parse(data, {
        header: true,
        complete: (results) => {
          const companyGroups = groupByCompany(results.data);
          setCompanies(companyGroups);
          setLoading(false);
        },
        error: (error) => {
          console.error("Error parsing CSV:", error);
          setLoading(false);
        }
      });
    } catch (error) {
      console.error("Error processing CSV data:", error);
      setLoading(false);
    }
  };

  const groupByCompany = (data) => {
    const groups = {};
    
    data.forEach(row => {
      if (!row.Recipient) return;
      
      // Extract domain from email address
      const emailParts = row.Recipient.split('@');
      if (emailParts.length < 2) return;
      
      // Get domain and clean it up
      let domain = emailParts[1].split(',')[0].trim().toLowerCase();
      
      // Special handling for multiple recipients in one field
      if (row.Recipient.includes(',')) {
        // Split multiple recipients and process each
        const recipients = row.Recipient.split(',');
        recipients.forEach(recipient => {
          const recipParts = recipient.trim().split('@');
          if (recipParts.length < 2) return;
          
          const recipDomain = recipParts[1].split(',')[0].trim().toLowerCase();
          const companyName = getCompanyName(recipDomain);
          
          if (!groups[companyName]) {
            groups[companyName] = [];
          }
          
          if (!groups[companyName].includes(recipient.trim())) {
            groups[companyName].push(recipient.trim());
          }
        });
      } else {
        // Single recipient
        const companyName = getCompanyName(domain);
        
        if (!groups[companyName]) {
          groups[companyName] = [];
        }
        
        if (!groups[companyName].includes(row.Recipient)) {
          groups[companyName].push(row.Recipient);
        }
      }
    });
    
    return groups;
  };

  const getCompanyName = (domain) => {
    // Extract company name from domain
    // Strip common TLDs like .com, .org, etc.
    const domainParts = domain.split('.');
    if (domainParts.length > 1) {
      // Use the domain name part as the company name
      return domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
    }
    return domain;
  };

  const toggleCompany = (companyName) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyName]: !prev[companyName]
    }));
  };

  return (
    <div className="h-full overflow-y-auto bg-[#1a1a1a] text-white border-r border-gray-700 p-2">
      <h3 className="font-bold mb-4 text-lg">Companies</h3>
      
      {loading ? (
        <div className="text-gray-400 text-sm text-center py-4">Loading...</div>
      ) : (
        <>
          {Object.keys(companies).length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-4">No companies found</div>
          ) : (
            <div className="space-y-2">
              {Object.keys(companies).sort().map((company) => (
                <div key={company} className="border-b border-[#333333] pb-2">
                  <div 
                    className="flex items-center justify-between cursor-pointer py-2 text-white hover:bg-[#2d2d2d] px-2 rounded-md"
                    onClick={() => toggleCompany(company)}
                  >
                    <span className="font-medium">{company}</span>
                    {expandedCompanies[company] ? (
                      <FiChevronDown size={16} />
                    ) : (
                      <FiChevronRight size={16} />
                    )}
                  </div>
                  
                  {expandedCompanies[company] && (
                    <div className="pl-4 pt-1 space-y-1 max-h-[300px] overflow-y-auto">
                      {companies[company].map((email, index) => (
                        <div 
                          key={index} 
                          className="text-gray-300 text-sm py-1 px-2 hover:bg-[#2d2d2d] rounded-md"
                        >
                          {email}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CompanyDirectory;
