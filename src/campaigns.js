/* 
Sklik connector for Google Data Studio
Copyright (C) 2018 Seznam.cz, a.s.

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.
This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

Seznam.cz, a.s.
Radlická 3294/10, Praha 5, 15000, Czech Republic
http://www.seznam.cz, or contact: https://napoveda.sklik.cz/casto-kladene-dotazy/kontaktni-formular/
*/

/**
 * If the user wants data from ads, this class do all rutins (createReport, readReport) 
 * and transforme data from readReport response to GDS format
 * @param {Root} rRoot 
 */
var CampaignsClass = function (rRoot) {
  /**
  * @param {Root}
  */
  this.Root = rRoot;

  /**
   * @param {DataCore} 
   */
  this.DC = new DataCore(rRoot, 'campaigns');

  /**
  *
  * @param {Object} params - {limit - limit for readReport - can be agregate by stats granularity}
  */
  this.getDataFromApi = function(granularity, params) {
    var restrictionFilter = {
      'dateFrom': this.Root.startDate,
      'dateTo': this.Root.endDate
    };
    
    if (this.Root.campaignsId.length > 0) {
      restrictionFilter.ids = this.Root.campaignsId;
    }

    if(this.Root.campaignsTypes.length > 0) {
      restrictionFilter.type = this.Root.campaignsTypes;
    }

    var displayOptions = {
      'statGranularity': granularity
    }

    var response = this.Root.sklikApiCall(
      'campaigns.createReport', 
      [
        { 'session': this.Root.session, 'userId': this.Root.userId },
        restrictionFilter,
        displayOptions
      ],
      1
    );
    
    if (response.reportId != undefined && response.totalCount != undefined) {
      return this.readReportRoot(response.reportId, response.totalCount, params.limit);
    } else {
      this.Root.Log.addRecord('Nepodařilo se získat reportId nebo totalCount z createReportu', true, 'CampaignsClass.getDataFromApi()');
      this.Root.Log.addValue(response, true, 'CampaignsClass.getDataFromApi()');
      return false;
    }
  }

  /**
   * This method is overlay for readReport because we allowed read data from 15000 rows (we need called in 3 cycle). 
   * But for outside methods we need return only one object, so we need merge all responses to one.
   * @param {String} reportId
   * @param {Int} totalCount
   * @param {Int} limit
   * @return {Object|False} 
   */
  this.readReportRoot = function(reportId, totalCount, limit) {
    var completeResponse = {};    
    var response;

    if (totalCount > limit) {
      this.Root.Log.addRecord('Počet kampaní je více než povolená hodnota - požadujete '+totalCount+' a limit je nastaven na '+limit+'.'
         +' Bude tedy zobrazeno pouze limitní část celého seznamu. Zkuste omezit načítání na vybrané kampaně, nebo snižte časový rozsah.');      
    }
    var cycle = Math.ceil(totalCount/limit);
    for (var c = 0; c < cycle && c < 3; c++) {
      response = this.readReport(reportId, c*limit, limit);
      if(!response) {
        this.Root.Log.addDebug('-//- Jedna z odpovědí je FALSE', 'Campaigns.readReportRoot()');
        return false;
      }
      if (c == 0) {
        completeResponse = response;
      } else {
        completeResponse.report = completeResponse.report.concat(response.report);
      }
    }
    this.Root.Log.addDebug('-//- Complete reponse from', 'Campaigns.readReportRoot()', completeResponse); 
    return completeResponse;
  }

  /**
   * @param {String} reportId
   * @param {Int} offset
   * @param {Int} limit
   * @return {Mixed} response or False
   */
  this.readReport = function(reportId, offset, limit) {
    return this.Root.sklikApiCall(
      'campaigns.readReport',
      [{ 'session': this.Root.session, 'userId': this.Root.userId },
      reportId,
      {
        'offset': offset,
        'limit': limit,
        'allowEmptyStatistics': this.Root.allowEmptyStatistics,
        'displayColumns': this.DC.getColumns('campaigns')
      }],
      1
    );
  }

  /**
   * Need data overturn from API response to GDS format
   * @param {Object} response - Response from campaigns.readReport
   * @return {Boolean}
   */
  this.convertDataToGDS = function (response) {
    return this.DC.returnDataPackage(response, 'campaigns');
  }

  /**
   * Need data overturn from API response to GDS format
   * @param {Object} response - Response from campaigns.readReport
   * @return {Boolean}
   */
  this.convertDataToGDSInGranularity = function (response) {
    return this.DC.returnDataPackageInGranularity(response, 'campaigns');
  }
}