// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.

define([
  "app",
  "api",
  "addons/fauxton/components",
  "addons/documents/resources",
  "addons/databases/resources",

  // Views
  "addons/documents/shared-views",
  "addons/documents/views-queryoptions",

  // React
  'addons/documents/header/header.react',
  'addons/documents/header/header.actions',
  'addons/documents/pagination/pagination.react',
  'addons/documents/index-results/actions',
  'addons/documents/pagination/stores',

  //plugins
  "plugins/prettify"
],

function (app, FauxtonAPI, Components, Documents,
  Databases, Views, QueryOptions, ReactHeader, ReactHeaderActions,
  ReactPagination, IndexResultsActions, PaginationStores) {

  function showError (msg) {
    FauxtonAPI.addNotification({
      msg: msg,
      type: 'error',
      clear:  true
    });
  }

  Views.Footer = FauxtonAPI.View.extend({
    afterRender: function () {
      ReactPagination.renderFooter(this.el);
    },

    cleanup: function () {
      ReactPagination.removeFooter(this.el);
    }
  });

  Views.ReactHeaderbar = FauxtonAPI.View.extend({
    afterRender: function () {
      ReactHeader.renderHeaderController(this.el);
    },

    cleanup: function () {
      this.disableHeader();
      ReactHeader.removeHeaderController(this.el);
    },

    disableHeader: function () {
      ReactHeaderActions.resetHeaderController();
    }
  });

  Views.RightAllDocsHeader = FauxtonAPI.View.extend({
    className: "header-right",
    template: "addons/documents/templates/all_docs_header",
    events: {
      'click .toggle-select-menu': 'selectAllMenu'
    },

    initialize: function (options) {
      this.database = options.database;
      this.params = options.params;

      _.bindAll(this);
      this.selectVisible = false;
      FauxtonAPI.Events.on('success:bulkDelete', this.selectAllMenu);

      // insert the Search Docs field
      this.headerSearch = this.insertView("#header-search", new Views.JumpToDoc({
        database: this.database,
        collection: this.database.allDocs
      }));

      // add the Query Options modal + header link
      this.queryOptions = this.insertView("#query-options", new QueryOptions.QueryOptionsTray({
        hasReduce: false,
        showStale: false
      }));
    },

    afterRender: function () {
      this.toggleQueryOptionsHeader(this.isHidden);
    },

    cleanup: function () {
      FauxtonAPI.Events.unbind('success:bulkDelete');
    },

    selectAllMenu: function (e) {
      FauxtonAPI.triggerRouteEvent("toggleSelectHeader");
      FauxtonAPI.Events.trigger("documents:showSelectAll", this.selectVisible);
    },

    // updates the API bar when the route changes
    updateApiUrl: function (api) {
      this.apiBar && this.apiBar.update(api);
    },

    // these are similar, but different! resetQueryOptions() completely resets the settings then overlays the new ones;
    // updateQueryOptions() just updates the existing settings with whatever is specified. Between them, the
    resetQueryOptions: function (options) {
      this.queryOptions.resetQueryOptions(options);
    },

    updateQueryOptions: function (options) {
      this.queryOptions.updateQueryOptions(options);
    },

    hideQueryOptions: function () {
      this.isHidden = true;
      if (this.hasRendered) {
        this.toggleQueryOptionsHeader(this.isHidden);
      }
    },

    showQueryOptions: function () {
      this.isHidden = false;
      if (this.hasRendered) {
        this.toggleQueryOptionsHeader(this.isHidden);
      }
    },

    toggleQueryOptionsHeader: function (hide) {
      $("#header-query-options").toggleClass("hide", hide);
    },

    serialize: function () {
      return {
        database: this.database.get('id')
      };
    }
  });


  Views.DeleteDBModal = Components.ModalView.extend({
    template: "addons/documents/templates/delete_database_modal",
    initialize: function (options) {
      this.database = options.database;
      this.isSystemDatabase = options.isSystemDatabase;
      FauxtonAPI.Events.on('database:delete', this.showDeleteDatabase, this);
    },

    serialize: function () {
      return {
        isSystemDatabase: this.isSystemDatabase,
        database: this.database
      };
    },

    showDeleteDatabase: function () {
      this.showModal();
    },

    cleanup: function () {
      FauxtonAPI.Events.off('database:delete', this.showDeleteDatabase);
    },

    events: {
      "click #delete-db-btn": "deleteDatabase",
      "submit #delete-db-check": "deleteDatabase"
    },

    deleteDatabase: function (event) {
      event.preventDefault();

      var enteredName = $('#db_name').val();
      if (this.database.id != enteredName) {
        this.set_error_msg(enteredName + " does not match the database name.");
        return;
      }

      this.hideModal();
      var databaseName = this.database.id;
      FauxtonAPI.addNotification({
        msg: "Deleting your database...",
        type: "error",
        clear: true
      });

      this.database.url = FauxtonAPI.urls('databaseBaseURL', 'server', this.database.safeID(), '');

      this.database.destroy().then(function () {
        FauxtonAPI.navigate(FauxtonAPI.urls('allDBs', 'app'));
        FauxtonAPI.addNotification({
          msg: 'The database <code>' + _.escape(databaseName) + '</code> has been deleted.',
          clear: true,
          escape: false // beware of possible XSS when the message changes
        });
      }).fail(function (rsp, error, msg) {
        FauxtonAPI.addNotification({
          msg: 'Could not delete the database, reason ' + msg + '.',
          type: 'error',
          clear: true
        });
      });
    }
  });

  Views.JumpToDoc = FauxtonAPI.View.extend({
    template: "addons/documents/templates/jumpdoc",

    initialize: function (options) {
      this.database = options.database;
    },

    events: {
      "submit #jump-to-doc": "jumpToDoc"
    },

    jumpToDoc: function (event) {
      event.preventDefault();
      var docId = this.$('#jump-to-doc-id').val().trim();
      var url = FauxtonAPI.urls('document', 'app', app.utils.safeURLName(this.database.id), app.utils.safeURLName(docId) );
      FauxtonAPI.navigate(url, {trigger: true});
    },

    afterRender: function () {
      this.typeAhead = new Components.DocSearchTypeahead({el: '#jump-to-doc-id', database: this.database});
      this.typeAhead.render();
    }
  });



  Views.DdocInfo = FauxtonAPI.View.extend({
    template: "addons/documents/templates/ddoc_info",

    initialize: function (options) {
      this.ddocName = options.ddocName;
      this.refreshTime = options.refreshTime || 5000;
      this.listenTo(this.model, 'change', this.render);
    },

    establish: function () {
      return this.model.fetch();
    },

    afterRender: function () {
      this.startRefreshInterval();
    },

    serialize: function () {
      return {
        Ddoc: this.ddocName,
        view_index: this.model.get('view_index')
      };
    },

    startRefreshInterval: function () {
      var model = this.model;

      // Interval already set
      if (this.intervalId) { this.stopRefreshInterval(); }

      this.intervalId = setInterval(function () {
        model.fetch();
      }, this.refreshTime);
    },

    stopRefreshInterval: function () {
      clearInterval(this.intervalId);
    },

    cleanup: function () {
      this.stopRefreshInterval();
    }
  });

  Documents.Views = Views;

  return Documents;
});
